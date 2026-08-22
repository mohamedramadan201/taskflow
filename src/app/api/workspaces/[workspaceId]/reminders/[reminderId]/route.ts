import { errorResponse, HttpError, requireMembership } from "@/lib/server/authorization";
import { logWorkspaceReminder, normalizeReminderEmails, normalizeReminderTags } from "@/lib/server/workspace-reminders";
import { prisma } from "@/lib/server/prisma";
import { parseJson, workspaceReminderActionSchema, workspaceReminderPatchSchema } from "@/lib/validation";

async function getReminder(workspaceId: string, reminderId: string) {
  const reminder = await prisma.workspaceReminder.findFirst({ where: { id: reminderId, workspaceId, archivedAt: null } });
  if (!reminder) throw new HttpError(404, "Reminder not found");
  return reminder;
}

function canEdit(reminder: { createdByUserId: string }, access: { user: { id: string }; subject: { role: string } }) {
  return reminder.createdByUserId === access.user.id || access.subject.role === "OWNER" || access.subject.role === "ADMIN";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ workspaceId: string; reminderId: string }> }) {
  try {
    const { workspaceId, reminderId } = await params;
    const access = await requireMembership(workspaceId);
    const reminder = await getReminder(workspaceId, reminderId);
    if (!canEdit(reminder, access)) throw new HttpError(403, "Reminder edit denied");
    const input = await parseJson(request, workspaceReminderPatchSchema);
    const updated = await prisma.workspaceReminder.update({ where: { id: reminder.id }, data: { ...(input.title !== undefined ? { title: input.title } : {}), ...(input.details !== undefined ? { details: input.details || null } : {}), ...(input.assignedEmails !== undefined ? { assignedEmails: normalizeReminderEmails(input.assignedEmails) } : {}), ...(input.reminderAt !== undefined ? { reminderAt: new Date(input.reminderAt) } : {}), ...(input.priority !== undefined ? { priority: input.priority } : {}), ...(input.tags !== undefined ? { tags: normalizeReminderTags(input.tags) } : {}), ...(input.repeatType !== undefined ? { repeatType: input.repeatType } : {}), ...(input.repeatInterval !== undefined ? { repeatInterval: input.repeatInterval } : {}), ...(input.repeatEndDate !== undefined ? { repeatEndDate: input.repeatEndDate ? new Date(input.repeatEndDate) : null } : {}), ...(input.notes !== undefined ? { notes: input.notes || null } : {}), ...(input.calendarPopupMinutes !== undefined ? { calendarPopupMinutes: input.calendarPopupMinutes } : {}), status: reminder.status === "SENT" || reminder.status === "ERROR" ? "PENDING" : reminder.status, errorMessage: null } });
    await logWorkspaceReminder({ workspaceId, reminderId, title: updated.title, assignedEmails: updated.assignedEmails, action: "Update", result: "Success", message: "Reminder updated." });
    return Response.json(updated);
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string; reminderId: string }> }) {
  try {
    const { workspaceId, reminderId } = await params;
    const access = await requireMembership(workspaceId);
    const reminder = await getReminder(workspaceId, reminderId);
    if (!canEdit(reminder, access)) throw new HttpError(403, "Reminder action denied");
    const input = await parseJson(request, workspaceReminderActionSchema);
    const now = new Date();
    const data = input.action === "DONE" ? { status: "DONE" as const, doneAt: now, lastUpdatedAt: now } : input.action === "CANCELLED" ? { status: "CANCELLED" as const, cancelledAt: now, lastUpdatedAt: now } : { status: "PENDING" as const, reminderAt: new Date(input.reminderAt), snoozedAt: now, snoozeCount: { increment: 1 }, errorMessage: null, lastUpdatedAt: now };
    const updated = await prisma.workspaceReminder.update({ where: { id: reminder.id }, data });
    await logWorkspaceReminder({ workspaceId, reminderId, title: updated.title, assignedEmails: updated.assignedEmails, action: input.action === "SNOOZE" ? "Snooze" : input.action === "DONE" ? "Done" : "Cancel", result: "Success", message: input.action === "SNOOZE" ? `Reminder snoozed to ${updated.reminderAt.toISOString()}.` : `Reminder marked as ${input.action.toLowerCase()}.` });
    return Response.json(updated);
  } catch (error) { return errorResponse(error); }
}
