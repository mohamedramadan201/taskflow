import { assertPermission, errorResponse, requireMembership } from "@/lib/server/authorization";
import { logWorkspaceReminder, matchesReminderFilter, normalizeReminderEmails, normalizeReminderTags, type ReminderFilter } from "@/lib/server/workspace-reminders";
import { prisma } from "@/lib/server/prisma";
import { parseJson, workspaceReminderInputSchema } from "@/lib/validation";

const reminderSelect = { id: true, workspaceId: true, title: true, details: true, assignedEmails: true, reminderAt: true, status: true, createdByUserId: true, createdAt: true, sentAt: true, cancelledAt: true, doneAt: true, lastUpdatedAt: true, notes: true, errorMessage: true, repeatType: true, repeatInterval: true, repeatEndDate: true, occurrenceCount: true, lastSentAt: true, priority: true, tags: true, calendarPopupMinutes: true, snoozedAt: true, snoozeCount: true, archivedAt: true, createdBy: { select: { id: true, name: true, email: true } } } as const;

export async function GET(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    const access = await requireMembership(workspaceId);
    const url = new URL(request.url);
    const filter = (url.searchParams.get("filter") || "all") as ReminderFilter;
    const view = url.searchParams.get("view") || "pending";
    const take = Math.min(Math.max(Number(url.searchParams.get("limit")) || 200, 1), 500);
    const records = await prisma.workspaceReminder.findMany({ where: { workspaceId, archivedAt: null }, select: reminderSelect, orderBy: view === "pending" ? { reminderAt: "asc" } : { lastUpdatedAt: "desc" }, take });
    const userEmail = access.user.email.toLowerCase();
    const visible = records.filter((item) => {
      const history = ["SENT", "DONE", "CANCELLED", "ERROR"].includes(item.status);
      if (view === "pending" && item.status !== "PENDING") return false;
      if (view === "history" && !history) return false;
      if (filter === "createdByMe") return item.createdBy.email.toLowerCase() === userEmail;
      return matchesReminderFilter(item, filter, userEmail);
    });
    const all = records.filter((item) => !["CANCELLED", "DONE"].includes(item.status));
    const now = new Date();
    const dashboard = { pending: all.filter((item) => item.status === "PENDING").length, overdue: all.filter((item) => item.status === "PENDING" && item.reminderAt < now).length, dueToday: all.filter((item) => item.status === "PENDING" && item.reminderAt.toDateString() === now.toDateString()).length, recurring: all.filter((item) => item.repeatType !== "NONE").length, errors: all.filter((item) => item.status === "ERROR").length };
    const settings = await prisma.workspaceReminderSettings.findUnique({ where: { workspaceId } });
    const logs = url.searchParams.get("includeLogs") === "true" ? await prisma.workspaceReminderLog.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 100 }) : [];
    return Response.json({ reminders: visible, dashboard, settings, logs });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    const access = await requireMembership(workspaceId);
    assertPermission(access.subject, "TASK_CREATE", "Reminder creation denied");
    const input = await parseJson(request, workspaceReminderInputSchema);
    const reminder = await prisma.workspaceReminder.create({ data: { workspaceId, title: input.title, details: input.details || null, assignedEmails: normalizeReminderEmails(input.assignedEmails), reminderAt: new Date(input.reminderAt), createdByUserId: access.user.id, notes: input.notes || null, repeatType: input.repeatType, repeatInterval: input.repeatInterval, repeatEndDate: input.repeatEndDate ? new Date(input.repeatEndDate) : null, priority: input.priority, tags: normalizeReminderTags(input.tags), calendarPopupMinutes: input.calendarPopupMinutes } });
    await logWorkspaceReminder({ workspaceId, reminderId: reminder.id, title: reminder.title, assignedEmails: reminder.assignedEmails, action: "Create", result: "Success", message: "Reminder created." });
    return Response.json(reminder, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
