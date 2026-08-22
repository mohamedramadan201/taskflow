import { buildEmailDeliverySubject } from "@/lib/email-delivery";
import { sendNotificationEmail } from "@/lib/server/email-provider";
import { prisma } from "@/lib/server/prisma";
import { getNextReminderDate } from "@/lib/workspace-reminders";
export { getNextReminderDate, normalizeReminderEmails, normalizeReminderTags, matchesReminderFilter } from "@/lib/workspace-reminders";
export type { ReminderFilter } from "@/lib/workspace-reminders";

export async function logWorkspaceReminder(input: { workspaceId: string; reminderId?: string | null; title: string; assignedEmails?: string[]; action: string; result: string; message: string }) {
  try {
    await prisma.workspaceReminderLog.create({ data: { workspaceId: input.workspaceId, reminderId: input.reminderId || null, taskTitle: input.title, assignedEmails: (input.assignedEmails || []).join(", "), action: input.action, result: input.result, message: input.message } });
  } catch (error) {
    console.warn("Workspace reminder log failed", error);
  }
}

export function buildWorkspaceReminderEmail(input: { title: string; details?: string | null; priority: string; tags: string[]; reminderAt: Date; notes?: string | null; intro?: string; signature?: string }) {
  const lines = [
    input.intro || "Hello,\n\nThis is a reminder for the following task:",
    "",
    `Task: ${input.title}`,
    "",
    `Details:\n${input.details || "-"}`,
    "",
    `Priority: ${input.priority}`,
    `Tags: ${input.tags.length ? input.tags.join(", ") : "-"}`,
    `Reminder time: ${input.reminderAt.toLocaleString("en-GB", { timeZone: "Asia/Riyadh" })}`,
    "",
    `Notes:\n${input.notes || "-"}`,
    "",
    input.signature || "Regards,\nTaskFlow",
  ];
  return lines.join("\n");
}

export async function processWorkspaceReminders(limit = 25) {
  const now = new Date();
  const due = await prisma.workspaceReminder.findMany({ where: { status: "PENDING", reminderAt: { lte: now } }, include: { createdBy: { select: { email: true } } }, orderBy: { reminderAt: "asc" }, take: Math.min(Math.max(limit, 1), 100) });
  let sent = 0; let failed = 0;
  for (const reminder of due) {
    const claimed = await prisma.workspaceReminder.updateMany({ where: { id: reminder.id, status: "PENDING" }, data: { status: "PROCESSING", lastUpdatedAt: new Date() } });
    if (!claimed.count) continue;
    try {
      const settings = await prisma.workspaceReminderSettings.findUnique({ where: { workspaceId: reminder.workspaceId } });
      const recipients = [...new Set([...reminder.assignedEmails, ...(settings?.sendCopyToCreator ? [reminder.createdBy.email] : [])])];
      if (!recipients.length) throw new Error("No recipient emails configured");
      const body = buildWorkspaceReminderEmail({ title: reminder.title, details: reminder.details, priority: reminder.priority, tags: reminder.tags, reminderAt: reminder.reminderAt, notes: reminder.notes, intro: settings?.defaultEmailIntro, signature: settings?.defaultEmailSignature });
      await Promise.all(recipients.map((to) => sendNotificationEmail({ to, subject: buildEmailDeliverySubject("TASK_REMINDER"), text: body })));
      const next = getNextReminderDate(reminder.reminderAt, reminder.repeatType, reminder.repeatInterval, now);
      const canRepeat = Boolean(next && (!reminder.repeatEndDate || next <= reminder.repeatEndDate));
      await prisma.workspaceReminder.update({ where: { id: reminder.id }, data: { status: canRepeat ? "PENDING" : "SENT", reminderAt: canRepeat ? next! : reminder.reminderAt, sentAt: new Date(), lastSentAt: new Date(), occurrenceCount: { increment: 1 }, errorMessage: null, lastUpdatedAt: new Date() } });
      await logWorkspaceReminder({ workspaceId: reminder.workspaceId, reminderId: reminder.id, title: reminder.title, assignedEmails: recipients, action: "Send", result: "Success", message: canRepeat ? `Reminder sent; next occurrence scheduled for ${next!.toISOString()}.` : "Reminder sent successfully." });
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Reminder delivery failed";
      await prisma.workspaceReminder.update({ where: { id: reminder.id }, data: { status: "ERROR", errorMessage: message, lastUpdatedAt: new Date() } });
      await logWorkspaceReminder({ workspaceId: reminder.workspaceId, reminderId: reminder.id, title: reminder.title, assignedEmails: reminder.assignedEmails, action: "Send", result: "Error", message });
      failed += 1;
    }
  }
  return { processed: sent + failed, sent, failed };
}
