import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type EmailRule = {
  action: "INCLUDE" | "EXCLUDE";
  field: "SENDER" | "RECIPIENT";
  matchType: "EXACT" | "DOMAIN";
  value: string;
  enabled?: boolean;
};

export type FilterableEmail = {
  senderAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  deliveredTo: string[];
};

export type InboundEmailIdentity = {
  gmailMessageId: string;
  internetMessageId?: string | null;
};

export function dedupeInboundEmails<T extends InboundEmailIdentity>(emails: T[]) {
  const gmailIds = new Set<string>();
  const internetMessageIds = new Set<string>();
  return emails.filter((email) => {
    const gmailMessageId = email.gmailMessageId.trim();
    const internetMessageId = email.internetMessageId?.trim().toLowerCase() || "";
    if (!gmailMessageId || gmailIds.has(gmailMessageId) || (internetMessageId && internetMessageIds.has(internetMessageId))) return false;
    gmailIds.add(gmailMessageId);
    if (internetMessageId) internetMessageIds.add(internetMessageId);
    return true;
  });
}

export function createConnectorToken() {
  return randomBytes(32).toString("base64url");
}

export function hashConnectorToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function connectorTokenMatches(token: string, hash: string) {
  const actual = Buffer.from(hashConnectorToken(token));
  const expected = Buffer.from(hash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function normalizeRuleValue(rule: Pick<EmailRule, "matchType" | "value">) {
  const normalized = rule.value.trim().toLowerCase();
  return rule.matchType === "DOMAIN" ? normalized.replace(/^@/, "") : normalized;
}

function matches(address: string, rule: EmailRule) {
  const candidate = address.trim().toLowerCase();
  const value = normalizeRuleValue(rule);
  if (rule.matchType === "EXACT") return candidate === value;
  const at = candidate.lastIndexOf("@");
  return at >= 0 && candidate.slice(at + 1) === value;
}

export function emailPassesRules(email: FilterableEmail, mailboxAddress: string, rules: EmailRule[]) {
  const active = rules.filter((rule) => rule.enabled !== false);
  const recipients = [...email.toAddresses, ...email.ccAddresses, ...email.deliveredTo, mailboxAddress]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const candidates = { SENDER: [email.senderAddress], RECIPIENT: [...new Set(recipients)] } as const;

  for (const field of ["SENDER", "RECIPIENT"] as const) {
    const fieldRules = active.filter((rule) => rule.field === field);
    if (fieldRules.some((rule) => rule.action === "EXCLUDE" && candidates[field].some((address) => matches(address, rule)))) return false;
    const includes = fieldRules.filter((rule) => rule.action === "INCLUDE");
    if (includes.length && !includes.some((rule) => candidates[field].some((address) => matches(address, rule)))) return false;
  }
  return true;
}

export function connectorIsDue(connector: { enabled: boolean; syncIntervalMinutes: number; lastSyncAt: Date | null; syncRequestedAt: Date | null }, now = new Date()) {
  if (!connector.enabled) return false;
  if (connector.syncRequestedAt && (!connector.lastSyncAt || connector.syncRequestedAt > connector.lastSyncAt)) return true;
  if (!connector.lastSyncAt) return true;
  return now.getTime() - connector.lastSyncAt.getTime() >= connector.syncIntervalMinutes * 60_000;
}
