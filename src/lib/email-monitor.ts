export type EmailMonitorStatus = "WAITING" | "NEEDS_REPLY" | "HANDLED" | "REOPENED" | "NO_ACTION_NEEDED";

export type MonitorMessage = {
  senderAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  subject: string;
  receivedAt: Date | string;
  isSent?: boolean;
};

export type EmailMonitorConfig = {
  targetAddress: string;
  responderEmails: string[];
  slaHours: number;
  excludedSenderEmails: string[];
  excludedSubjectKeywords: string[];
};

export type EmailMonitorEvaluation = {
  status: EmailMonitorStatus;
  latestRelevantSenderAddress: string | null;
  latestRelevantMessageAt: Date | null;
  latestExternalMessageAt: Date | null;
  teamReplyAt: Date | null;
  slaDueAt: Date | null;
  priority: "Normal" | "High" | null;
  agingBucket: "4-8h" | "8-24h" | "24h+" | null;
};

function normalize(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function unique(values: string[]) {
  return [...new Set(values.map(normalize).filter(Boolean))];
}

function includesTarget(message: MonitorMessage, targetAddress: string) {
  const target = normalize(targetAddress);
  return [...message.toAddresses, ...message.ccAddresses].some((address) => normalize(address) === target);
}

function excluded(message: MonitorMessage, config: EmailMonitorConfig) {
  const sender = normalize(message.senderAddress);
  if (unique(config.excludedSenderEmails).includes(sender)) return true;
  const subject = normalize(message.subject);
  return config.excludedSubjectKeywords.some((keyword) => subject.includes(normalize(keyword)));
}

function hoursBetween(from: Date, to: Date) {
  return Math.max(0, (to.getTime() - from.getTime()) / 3_600_000);
}

function agingBucket(hours: number): EmailMonitorEvaluation["agingBucket"] {
  if (hours < 8) return "4-8h";
  if (hours < 24) return "8-24h";
  return "24h+";
}

function priority(hours: number): EmailMonitorEvaluation["priority"] {
  return hours >= 24 ? "High" : "Normal";
}

export function evaluateEmailMonitorThread(messages: MonitorMessage[], config: EmailMonitorConfig, now = new Date(), wasPreviouslyHandled = false, manualNoActionMessageAt: Date | null = null): EmailMonitorEvaluation {
  const responders = unique(config.responderEmails);
  const ordered = [...messages].sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());
  let latest: { kind: "team" | "external"; message: MonitorMessage; address: string } | null = null;

  for (const message of ordered) {
    if (excluded(message, config)) continue;
    const sender = normalize(message.senderAddress);
    const isResponder = responders.includes(sender);
    if (isResponder) {
      latest = { kind: "team", message, address: sender };
    } else if (includesTarget(message, config.targetAddress)) {
      latest = { kind: "external", message, address: sender };
    }
  }

  if (!latest) return { status: "WAITING", latestRelevantSenderAddress: null, latestRelevantMessageAt: null, latestExternalMessageAt: null, teamReplyAt: null, slaDueAt: null, priority: null, agingBucket: null };

  const latestAt = new Date(latest.message.receivedAt);
  if (latest.kind === "team") {
    return { status: "HANDLED", latestRelevantSenderAddress: latest.address, latestRelevantMessageAt: latestAt, latestExternalMessageAt: null, teamReplyAt: latestAt, slaDueAt: null, priority: null, agingBucket: null };
  }

  const externalAt = latestAt;
  const slaDueAt = new Date(externalAt.getTime() + config.slaHours * 3_600_000);
  const ageHours = hoursBetween(externalAt, now);
  if (manualNoActionMessageAt && externalAt.getTime() <= manualNoActionMessageAt.getTime()) {
    return { status: "NO_ACTION_NEEDED", latestRelevantSenderAddress: latest.address, latestRelevantMessageAt: latestAt, latestExternalMessageAt: externalAt, teamReplyAt: null, slaDueAt, priority: ageHours >= 24 ? "High" : "Normal", agingBucket: ageHours >= config.slaHours ? agingBucket(ageHours) : null };
  }
  const overdue = ageHours >= config.slaHours;
  return { status: overdue ? (wasPreviouslyHandled ? "REOPENED" : "NEEDS_REPLY") : "WAITING", latestRelevantSenderAddress: latest.address, latestRelevantMessageAt: latestAt, latestExternalMessageAt: externalAt, teamReplyAt: null, slaDueAt, priority: overdue ? priority(ageHours) : null, agingBucket: overdue ? agingBucket(ageHours) : null };
}

export function monitorNeedsAction(status: EmailMonitorStatus) {
  return status === "NEEDS_REPLY" || status === "REOPENED";
}
