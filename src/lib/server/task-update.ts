import type { Prisma } from "@/generated/prisma/client";
import { buildEmailDeliverySubject } from "@/lib/email-delivery";
import { nextRecurringDate } from "@/lib/recurrence";
import { HttpError } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { statusUpdateFields } from "@/lib/task-status";
import type { z } from "zod";
import type { taskPatchSchema } from "@/lib/validation";

type TransactionClient = Prisma.TransactionClient;
export type TaskPatchInput = z.infer<typeof taskPatchSchema>;

export async function updateTaskWithinTransaction(tx: TransactionClient, task: Prisma.TaskModel, input: TaskPatchInput, actor: { id: string; email: string }) {
  const newAssignee = input.assigneeUserId ? await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: task.workspaceId, userId: input.assigneeUserId } }, select: { suspendedAt: true, user: { select: { email: true } } } }) : null;
  if (input.assigneeUserId && (!newAssignee || newAssignee.suspendedAt)) throw new HttpError(400, "Assignee must be an active member of this workspace");
  if (input.blockerTaskId === task.id) throw new HttpError(400, "A task cannot block itself");
  if (input.blockerTaskId && !(await tx.task.findFirst({ where: { id: input.blockerTaskId, workspaceId: task.workspaceId }, select: { id: true } }))) throw new HttpError(400, "Blocking task must belong to this workspace");
  const blockingChanged = input.blockedReason !== undefined || input.blockerTaskId !== undefined;
  const remainsBlocked = Boolean(input.blockedReason === undefined ? task.blockedReason : input.blockedReason) || Boolean(input.blockerTaskId === undefined ? task.blockerTaskId : input.blockerTaskId);
  const statusFields = input.status === undefined ? {} : statusUpdateFields(task, input.status);
  const updated = await tx.task.update({ where: { id: task.id }, data: { ...input, dueAt: input.dueAt === undefined ? undefined : input.dueAt ? new Date(input.dueAt) : null, ...statusFields, remainingMinutes: input.status === "DONE" && input.remainingMinutes === undefined ? 0 : input.remainingMinutes, blockedAt: blockingChanged ? remainsBlocked ? task.blockedAt ?? new Date() : null : undefined } });
  await tx.activityEvent.create({ data: { workspaceId: task.workspaceId, taskId: task.id, actorUserId: actor.id, type: "TASK_UPDATED", detailsJson: { fields: Object.keys(input) } } });
  const assignmentNotification = input.assigneeUserId && input.assigneeUserId !== task.assigneeUserId && newAssignee ? await tx.notification.create({ data: { workspaceId: task.workspaceId, taskId: task.id, userId: input.assigneeUserId, type: "TASK_ASSIGNED", message: `${actor.email} assigned you: ${updated.title}`, emailTo: newAssignee.user.email, emailSubject: buildEmailDeliverySubject("TASK_ASSIGNED") } }) : null;

  const alertMessages: string[] = [];
  if (!task.blockedAt && updated.blockedAt) alertMessages.push(`Blocked task needs attention: ${updated.title}`);
  if (updated.assigneeUserId && updated.status !== "DONE" && updated.status !== "NO_ACTION_NEEDED" && ["assigneeUserId", "estimatedMinutes", "remainingMinutes", "status"].some((field) => field in input)) {
    const [member, workspace, assigned] = await Promise.all([
      tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: updated.workspaceId, userId: updated.assigneeUserId } }, select: { weeklyCapacityMinutes: true, user: { select: { name: true, email: true } } } }),
      tx.workspace.findUnique({ where: { id: updated.workspaceId }, select: { overloadThreshold: true } }),
      tx.task.findMany({ where: { workspaceId: updated.workspaceId, assigneeUserId: updated.assigneeUserId, status: { notIn: ["DONE", "NO_ACTION_NEEDED"] } }, select: { estimatedMinutes: true, remainingMinutes: true } }),
    ]);
    const remaining = assigned.reduce((sum, assignedTask) => sum + (assignedTask.remainingMinutes ?? assignedTask.estimatedMinutes ?? 0), 0);
    if (member && workspace && remaining > member.weeklyCapacityMinutes * workspace.overloadThreshold / 100) alertMessages.push(`${member.user.name || member.user.email} is over capacity after updating: ${updated.title}`);
  }
  if (alertMessages.length) {
    const managers = await tx.workspaceMember.findMany({ where: { workspaceId: updated.workspaceId, suspendedAt: null, role: { in: ["OWNER", "ADMIN"] } }, select: { userId: true } });
    for (const message of alertMessages) {
      const existing = await tx.notification.findMany({ where: { workspaceId: updated.workspaceId, taskId: task.id, type: "SYSTEM", readAt: null, message, userId: { in: managers.map((manager) => manager.userId) } }, select: { userId: true } });
      const notified = new Set(existing.map((item) => item.userId));
      const recipients = managers.filter((manager) => !notified.has(manager.userId));
      if (recipients.length) await tx.notification.createMany({ data: recipients.map((manager) => ({ workspaceId: updated.workspaceId, taskId: task.id, userId: manager.userId, type: "SYSTEM", message, emailStatus: "SKIPPED" })) });
    }
  }

  const shouldRepeat = input.status === "DONE" && task.status !== "DONE" && updated.recurrence !== "NONE" && !task.recurrenceProcessedAt;
  let recurringTask = null;
  const claimed = shouldRepeat ? await tx.task.updateMany({ where: { id: task.id, recurrenceProcessedAt: null }, data: { recurrenceProcessedAt: new Date() } }) : { count: 0 };
  if (claimed.count === 1) {
    const dueAt = nextRecurringDate(updated.dueAt, updated.recurrence, updated.recurrenceInterval);
    recurringTask = await tx.task.create({ data: { workspaceId: updated.workspaceId, title: updated.title, description: updated.description, status: "TODO", priority: updated.priority, dueAt, recurrence: updated.recurrence, recurrenceInterval: updated.recurrenceInterval, estimatedMinutes: updated.estimatedMinutes, remainingMinutes: updated.estimatedMinutes, createdByUserId: actor.id, assigneeUserId: updated.assigneeUserId, followUpWith: updated.followUpWith } });
    await tx.activityEvent.create({ data: { workspaceId: updated.workspaceId, taskId: recurringTask.id, actorUserId: actor.id, type: "RECURRING_TASK_CREATED", detailsJson: { sourceTaskId: task.id, recurrence: updated.recurrence } } });
  }
  return { updated, recurringTask, assignmentNotificationId: assignmentNotification?.id };
}

export async function updateTaskLabelsWithinTransaction(tx: TransactionClient, task: Prisma.TaskModel, actorId: string, labelId: string, mode: "ADD_LABEL" | "REMOVE_LABEL") {
  const current = await tx.taskLabelAssignment.findMany({ where: { taskId: task.id }, select: { labelId: true } });
  const currentIds = new Set(current.map((item) => item.labelId));
  if (mode === "ADD_LABEL") currentIds.add(labelId); else currentIds.delete(labelId);
  const labelIds = [...currentIds];
  await tx.taskLabelAssignment.deleteMany({ where: { taskId: task.id } });
  if (labelIds.length) await tx.taskLabelAssignment.createMany({ data: labelIds.map((currentLabelId) => ({ taskId: task.id, labelId: currentLabelId })) });
  await tx.activityEvent.create({ data: { workspaceId: task.workspaceId, taskId: task.id, actorUserId: actorId, type: "TASK_LABELS_UPDATED", detailsJson: { labelIds, bulkAction: mode } } });
  return labelIds;
}

export async function findUpdatedTasks(taskIds: string[]) {
  return prisma.task.findMany({ where: { id: { in: taskIds } }, include: { assignee: { select: { id: true, name: true, email: true } }, labelAssignments: { include: { label: true } } } });
}
