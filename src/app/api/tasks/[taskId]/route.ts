import { after } from "next/server";
import { canAssignTaskTo, canDeleteTask, canModifyTask } from "@/lib/permissions";
import { HttpError, requireMembership, requireUser, errorResponse } from "@/lib/server/authorization";
import { deliverAssignmentNotification } from "@/lib/server/notification-service";
import { prisma } from "@/lib/server/prisma";
import { parseJson, taskPatchSchema } from "@/lib/validation";
import { updateTaskWithinTransaction } from "@/lib/server/task-update";
async function load(taskId: string) { const task = await prisma.task.findUnique({ where: { id: taskId } }); if (!task) throw new HttpError(404, "Task not found"); return { task, access: await requireMembership(task.workspaceId) }; }
export async function GET(_: Request, { params }: { params: Promise<{ taskId: string }> }) { try { const [{ taskId }, user] = await Promise.all([params, requireUser()]); const detail = await prisma.task.findFirst({ where: { id: taskId, workspace: { members: { some: { userId: user.id } } } }, include: { assignee: { select: { id: true, name: true, email: true } }, createdBy: { select: { id: true, name: true, email: true } }, blockerTask: { select: { id: true, title: true, status: true } }, sourceEmails: { select: { id: true, subject: true, senderAddress: true, receivedAt: true, connector: { select: { mailboxAddress: true } } }, orderBy: { receivedAt: "desc" } }, labelAssignments: { include: { label: true } }, checklistItems: { orderBy: { position: "asc" } }, comments: { include: { author: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } }, activities: { include: { actor: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 30 } } }); if (!detail) throw new HttpError(404, "Task not found"); const { labelAssignments, ...task } = detail; return Response.json({ ...task, labels: labelAssignments.map(({ label }) => label) }); } catch (e) { return errorResponse(e); } }
export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) { try {
  const { taskId } = await params; const { task, access } = await load(taskId); if (!canModifyTask(access.subject, access.user.id, task)) throw new HttpError(403, "Task modification denied");
  const input = await parseJson(request, taskPatchSchema);
  if (input.assigneeUserId !== undefined && input.assigneeUserId !== task.assigneeUserId && !canAssignTaskTo(access.subject, access.user.id, input.assigneeUserId)) throw new HttpError(403, "Task assignment denied");
  const updated = await prisma.$transaction(async (tx) => {
    return updateTaskWithinTransaction(tx, task, input, access.user);
  });
  if (updated.assignmentNotificationId) after(() => deliverAssignmentNotification(updated.assignmentNotificationId!));
  return Response.json({ ...updated.updated, recurringTask: updated.recurringTask });
} catch (e) { return e instanceof Response ? e : errorResponse(e); } }
export async function DELETE(_: Request, { params }: { params: Promise<{ taskId: string }> }) { try {
  const { taskId } = await params; const { task, access } = await load(taskId); if (!canDeleteTask(access.subject, access.user.id, task)) throw new HttpError(403, "Task deletion denied");
  await prisma.$transaction([prisma.activityEvent.create({ data: { workspaceId: task.workspaceId, actorUserId: access.user.id, type: "TASK_DELETED", detailsJson: { taskId, title: task.title } } }), prisma.task.delete({ where: { id: taskId } })]); return new Response(null, { status: 204 });
} catch (e) { return errorResponse(e); } }
