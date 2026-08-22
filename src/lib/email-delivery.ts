export type EmailDeliveryConfig =
  | { mode: "log"; from: string; logPath: string }
  | { mode: "apps_script"; from: string }
  | { mode: "smtp"; from: string; host: string; port: number; secure: boolean; user?: string; pass?: string };

export function getEmailDeliveryConfig(env: Record<string, string | undefined> = process.env): EmailDeliveryConfig {
  const from = env.EMAIL_FROM?.trim() || "TaskFlow <notifications@your-domain.com>";
  if (env.EMAIL_DELIVERY_MODE?.toLowerCase() === "apps_script") return { mode: "apps_script", from };
  if (env.EMAIL_DELIVERY_MODE?.toLowerCase() !== "smtp") {
    return { mode: "log", from, logPath: env.EMAIL_DELIVERY_LOG_PATH?.trim() || "./var/email-delivery.jsonl" };
  }
  const parsedPort = Number.parseInt(env.SMTP_PORT || "2525", 10);
  return {
    mode: "smtp",
    from,
    host: env.SMTP_HOST?.trim() || "127.0.0.1",
    port: Number.isFinite(parsedPort) ? parsedPort : 2525,
    secure: env.SMTP_SECURE?.toLowerCase() === "true",
    user: env.SMTP_USER?.trim() || undefined,
    pass: env.SMTP_PASS || undefined,
  };
}

const labels: Record<string, string> = { TASK_REMINDER: "Task reminder", TASK_ASSIGNED: "New task assigned", WORKSPACE_INVITATION: "Workspace invitation", SYSTEM: "TaskFlow update" };
export const buildEmailDeliverySubject = (type: string) => `[TaskFlow] ${labels[type] || "Notification"}`;
