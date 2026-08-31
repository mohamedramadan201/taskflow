import { assertPermission, HttpError, requireMembership, errorResponse } from "@/lib/server/authorization";
import { deliverReminder } from "@/lib/server/notification-service";
import { assertTaskVisible } from "@/lib/server/record-access";
import { prisma } from "@/lib/server/prisma";
import { parseJson, reminderSchema } from "@/lib/validation";
export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) { try {
  const { taskId } = await params; const task = await prisma.task.findUnique({ where: { id: taskId } }); if (!task) throw new HttpError(404, "Task not found");
  const access = await requireMembership(task.workspaceId); await assertTaskVisible(taskId, task.workspaceId, access.user.id, access.user.email); assertPermission(access.subject, "TASK_REMINDER", "Reminder creation denied");
  const input = await parseJson(request, reminderSchema); const recipientId = input.userId || task.assigneeUserId || access.user.id;
  if (!(await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: task.workspaceId, userId: recipientId } } }))) throw new HttpError(400, "Recipient must belong to this workspace");
  const reminder = await prisma.reminder.create({ data: { workspaceId: task.workspaceId, taskId, userId: recipientId, scheduledAt: new Date(input.scheduledAt) } });
  const result = reminder.scheduledAt <= new Date() ? await deliverReminder(reminder.id) : reminder;
  return Response.json(result, { status: 201 });
} catch (e) { return e instanceof Response ? e : errorResponse(e); } }
