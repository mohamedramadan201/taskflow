import { assertPermission, errorResponse, requireMembership } from "@/lib/server/authorization";
import { logWorkspaceReminder, normalizeReminderEmails, normalizeReminderTags } from "@/lib/server/workspace-reminders";
import { prisma } from "@/lib/server/prisma";
import { parseJson, workspaceReminderBulkSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    const access = await requireMembership(workspaceId);
    assertPermission(access.subject, "TASK_CREATE", "Reminder creation denied");
    const { reminders } = await parseJson(request, workspaceReminderBulkSchema);
    const results: Array<{ row: number; success: boolean; id?: string; title: string; error?: string }> = [];
    for (const [index, input] of reminders.entries()) {
      try {
        const reminder = await prisma.workspaceReminder.create({ data: { workspaceId, title: input.title, details: input.details || null, assignedEmails: normalizeReminderEmails(input.assignedEmails), reminderAt: new Date(input.reminderAt), createdByUserId: access.user.id, notes: input.notes || null, repeatType: input.repeatType, repeatInterval: input.repeatInterval, repeatEndDate: input.repeatEndDate ? new Date(input.repeatEndDate) : null, priority: input.priority, tags: normalizeReminderTags(input.tags), calendarPopupMinutes: input.calendarPopupMinutes } });
        await logWorkspaceReminder({ workspaceId, reminderId: reminder.id, title: reminder.title, assignedEmails: reminder.assignedEmails, action: "Create", result: "Success", message: "Reminder created from bulk upload." });
        results.push({ row: index + 1, success: true, id: reminder.id, title: reminder.title });
      } catch (error) {
        results.push({ row: index + 1, success: false, title: input.title, error: error instanceof Error ? error.message : "Could not create reminder" });
      }
    }
    const failed = results.filter((item) => !item.success).length;
    return Response.json({ success: failed === 0, summary: { total: results.length, created: results.length - failed, failed }, results }, { status: failed === results.length ? 400 : 200 });
  } catch (error) { return errorResponse(error); }
}
