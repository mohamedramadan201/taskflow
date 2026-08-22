import { assertPermission, errorResponse, requireMembership } from "@/lib/server/authorization";
import { buildEmailDeliverySubject } from "@/lib/email-delivery";
import { sendNotificationEmail } from "@/lib/server/email-provider";
import { prisma } from "@/lib/server/prisma";

export async function POST(_: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    const access = await requireMembership(workspaceId);
    assertPermission(access.subject, "WORKSPACE_MANAGE", "Reminder digest requires workspace management access");
    const now = new Date(); const end = new Date(now); end.setHours(23, 59, 59, 999);
    const settings = await prisma.workspaceReminderSettings.findUnique({ where: { workspaceId } });
    const reminders = await prisma.workspaceReminder.findMany({ where: { workspaceId, status: "PENDING", reminderAt: { lte: end }, archivedAt: null }, orderBy: { reminderAt: "asc" } });
    const grouped = new Map<string, typeof reminders>();
    for (const reminder of reminders) for (const email of reminder.assignedEmails) grouped.set(email, [...(grouped.get(email) || []), reminder]);
    let sentTo = 0;
    for (const [email, items] of grouped) {
      const body = ["Hello,", "", "Here is your TaskFlow reminder digest for today.", "", ...items.map((item, index) => `${index + 1}. [${item.priority}] ${item.title}\n   Time: ${item.reminderAt.toLocaleString("en-GB", { timeZone: "Asia/Riyadh" })}${item.reminderAt < now ? " - Overdue" : ""}`), "", settings?.defaultEmailSignature || "Regards,\nTaskFlow"].join("\n");
      await sendNotificationEmail({ to: email, subject: buildEmailDeliverySubject("TASK_REMINDER"), text: body });
      sentTo += 1;
    }
    return Response.json({ success: true, sentTo, reminders: reminders.length });
  } catch (error) { return errorResponse(error); }
}
