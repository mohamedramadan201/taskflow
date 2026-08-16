import { after } from "next/server";
import { canAssignTaskTo, canDeleteTask, canModifyTask } from "@/lib/permissions";
import { buildEmailDeliverySubject } from "@/lib/email-delivery";
import { HttpError, requireMembership, requireUser, errorResponse } from "@/lib/server/authorization";
import { deliverAssignmentNotification } from "@/lib/server/notification-service";
import { prisma } from "@/lib/server/prisma";
import { parseJson, taskPatchSchema } from "@/lib/validation";
import { nextRecurringDate } from "@/lib/recurrence";
async function load(taskId: string) { const task = await prisma.task.findUnique({ where: { id: taskId } }); if (!task) throw new HttpError(404, "Task not found"); return { task, access: await requireMembership(task.workspaceId) }; }
export async function GET(_: Request, { params }: { params: Promise<{ taskId: string }> }) { try { const [{ taskId }, user] = await Promise.all([params, requireUser()]); const detail = await prisma.task.findFirst({ where: { id: taskId, workspace: { members: { some: { userId: user.id } } } }, include: { assignee: { select: { id: true, name: true, email: true } }, createdBy: { select: { id: true, name: true, email: true } }, blockerTask: { select: { id: true, title: true, status: true } }, sourceEmails: { select: { id: true, subject: true, senderAddress: true, receivedAt: true, connector: { select: { mailboxAddress: true } } }, orderBy: { receivedAt: "desc" } }, labelAssignments: { include: { label: true } }, checklistItems: { orderBy: { position: "asc" } }, comments: { include: { author: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } }, activities: { include: { actor: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 30 } } }); if (!detail) throw new HttpError(404, "Task not found"); const { labelAssignments, ...task } = detail; return Response.json({ ...task, labels: labelAssignments.map(({ label }) => label) }); } catch (e) { return errorResponse(e); } }
export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) { try {
  const { taskId } = await params; const { task, access } = await load(taskId); if (!canModifyTask(access.subject, access.user.id, task)) throw new HttpError(403, "Task modification denied");
  const input = await parseJson(request, taskPatchSchema);
  if (input.assigneeUserId !== undefined && input.assigneeUserId !== task.assigneeUserId && !canAssignTaskTo(access.subject, access.user.id, input.assigneeUserId)) throw new HttpError(403, "Task assignment denied");
  const newAssignee = input.assigneeUserId ? await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: task.workspaceId, userId: input.assigneeUserId } }, select: { suspendedAt: true, user: { select: { email: true } } } }) : null;
  if (input.assigneeUserId && (!newAssignee || newAssignee.suspendedAt)) throw new HttpError(400, "Assignee must be an active member of this workspace");
  if (input.blockerTaskId === taskId) throw new HttpError(400, "A task cannot block itself");
  if (input.blockerTaskId && !(await prisma.task.findFirst({ where: { id: input.blockerTaskId, workspaceId: task.workspaceId }, select: { id: true } }))) throw new HttpError(400, "Blocking task must belong to this workspace");
  const blockingChanged = input.blockedReason !== undefined || input.blockerTaskId !== undefined;
  const remainsBlocked = Boolean(input.blockedReason === undefined ? task.blockedReason : input.blockedReason) || Boolean(input.blockerTaskId === undefined ? task.blockerTaskId : input.blockerTaskId);
  const updated = await prisma.$transaction(async (tx) => {
    const value = await tx.task.update({ where: { id: taskId }, data: { ...input, dueAt: input.dueAt === undefined ? undefined : input.dueAt ? new Date(input.dueAt) : null, startedAt: input.status === undefined ? undefined : input.status === "TODO" || input.status === "NO_ACTION_NEEDED" ? null : task.startedAt ?? new Date(), completedAt: input.status === undefined ? undefined : input.status === "DONE" ? task.completedAt ?? new Date() : null, remainingMinutes: input.status === "DONE" && input.remainingMinutes === undefined ? 0 : input.remainingMinutes, blockedAt: blockingChanged ? remainsBlocked ? task.blockedAt ?? new Date() : null : undefined } });
    await tx.activityEvent.create({ data: { workspaceId: task.workspaceId, taskId, actorUserId: access.user.id, type: "TASK_UPDATED", detailsJson: { fields: Object.keys(input) } } });
    const assignmentNotification = input.assigneeUserId && input.assigneeUserId !== task.assigneeUserId && newAssignee ? await tx.notification.create({ data: { workspaceId: task.workspaceId, taskId, userId: input.assigneeUserId, type: "TASK_ASSIGNED", message: `${access.user.email} assigned you: ${value.title}`, emailTo: newAssignee.user.email, emailSubject: buildEmailDeliverySubject("TASK_ASSIGNED") } }) : null;

    const alertMessages: string[] = [];
    if (!task.blockedAt && value.blockedAt) alertMessages.push(`Blocked task needs attention: ${value.title}`);
    if (value.assigneeUserId && value.status !== "DONE" && value.status !== "NO_ACTION_NEEDED" && ["assigneeUserId", "estimatedMinutes", "remainingMinutes", "status"].some((field) => field in input)) {
      const [member, workspace, assigned] = await Promise.all([
        tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: value.workspaceId, userId: value.assigneeUserId } }, select: { weeklyCapacityMinutes: true, user: { select: { name: true, email: true } } } }),
        tx.workspace.findUnique({ where: { id: value.workspaceId }, select: { overloadThreshold: true } }),
        tx.task.findMany({ where: { workspaceId: value.workspaceId, assigneeUserId: value.assigneeUserId, status: { notIn: ["DONE", "NO_ACTION_NEEDED"] } }, select: { estimatedMinutes: true, remainingMinutes: true } }),
      ]);
      const remaining = assigned.reduce((sum, assignedTask) => sum + (assignedTask.remainingMinutes ?? assignedTask.estimatedMinutes ?? 0), 0);
      if (member && workspace && remaining > member.weeklyCapacityMinutes * workspace.overloadThreshold / 100) alertMessages.push(`${member.user.name || member.user.email} is over capacity after updating: ${value.title}`);
    }
    if (alertMessages.length) {
      const managers = await tx.workspaceMember.findMany({ where: { workspaceId: value.workspaceId, suspendedAt: null, role: { in: ["OWNER", "ADMIN"] } }, select: { userId: true } });
      for (const message of alertMessages) {
        const existing = await tx.notification.findMany({ where: { workspaceId: value.workspaceId, taskId, type: "SYSTEM", readAt: null, message, userId: { in: managers.map((manager) => manager.userId) } }, select: { userId: true } });
        const notified = new Set(existing.map((item) => item.userId));
        const recipients = managers.filter((manager) => !notified.has(manager.userId));
        if (recipients.length) await tx.notification.createMany({ data: recipients.map((manager) => ({ workspaceId: value.workspaceId, taskId, userId: manager.userId, type: "SYSTEM", message, emailStatus: "SKIPPED" })) });
      }
    }

    const shouldRepeat = input.status === "DONE" && task.status !== "DONE" && value.recurrence !== "NONE" && !task.recurrenceProcessedAt; let recurringTask = null;
    const claimed = shouldRepeat ? await tx.task.updateMany({ where: { id: taskId, recurrenceProcessedAt: null }, data: { recurrenceProcessedAt: new Date() } }) : { count: 0 };
    if (claimed.count === 1) { const dueAt = nextRecurringDate(value.dueAt, value.recurrence, value.recurrenceInterval); recurringTask = await tx.task.create({ data: { workspaceId: value.workspaceId, title: value.title, description: value.description, status: "TODO", priority: value.priority, dueAt, recurrence: value.recurrence, recurrenceInterval: value.recurrenceInterval, estimatedMinutes: value.estimatedMinutes, remainingMinutes: value.estimatedMinutes, createdByUserId: access.user.id, assigneeUserId: value.assigneeUserId } }); await tx.activityEvent.create({ data: { workspaceId: value.workspaceId, taskId: recurringTask.id, actorUserId: access.user.id, type: "RECURRING_TASK_CREATED", detailsJson: { sourceTaskId: taskId, recurrence: value.recurrence } } }); }
    return { value, recurringTask, assignmentNotificationId: assignmentNotification?.id };
  });
  if (updated.assignmentNotificationId) after(() => deliverAssignmentNotification(updated.assignmentNotificationId!));
  return Response.json({ ...updated.value, recurringTask: updated.recurringTask });
} catch (e) { return e instanceof Response ? e : errorResponse(e); } }
export async function DELETE(_: Request, { params }: { params: Promise<{ taskId: string }> }) { try {
  const { taskId } = await params; const { task, access } = await load(taskId); if (!canDeleteTask(access.subject, access.user.id, task)) throw new HttpError(403, "Task deletion denied");
  await prisma.$transaction([prisma.activityEvent.create({ data: { workspaceId: task.workspaceId, actorUserId: access.user.id, type: "TASK_DELETED", detailsJson: { taskId, title: task.title } } }), prisma.task.delete({ where: { id: taskId } })]); return new Response(null, { status: 204 });
} catch (e) { return errorResponse(e); } }
