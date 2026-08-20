import { after } from "next/server";
import { allTaskIdsBelongToWorkspace, bulkTaskFailure } from "@/lib/bulk-task";
import { errorResponse, HttpError, requireMembership } from "@/lib/server/authorization";
import { deliverAssignmentNotification } from "@/lib/server/notification-service";
import { findUpdatedTasks, updateTaskLabelsWithinTransaction, updateTaskWithinTransaction, type TaskPatchInput } from "@/lib/server/task-update";
import { prisma } from "@/lib/server/prisma";
import { parseJson, taskBulkActionSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    const input = await parseJson(request, taskBulkActionSchema);
    const { user, subject } = await requireMembership(workspaceId);
    const taskIds = [...new Set(input.taskIds)];
    const tasks = await prisma.task.findMany({ where: { workspaceId, id: { in: taskIds } } });
    if (!allTaskIdsBelongToWorkspace(taskIds, tasks, workspaceId)) throw new HttpError(400, "Every selected task must belong to this workspace");

    const targetAssignee = input.action === "ASSIGN" && input.assigneeUserId ? await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: input.assigneeUserId } }, select: { userId: true, suspendedAt: true } }) : null;
    if (input.action === "ASSIGN" && input.assigneeUserId && (!targetAssignee || targetAssignee.suspendedAt)) throw new HttpError(400, "Assignee must be an active member of this workspace");
    if ((input.action === "ADD_LABEL" || input.action === "REMOVE_LABEL") && !(await prisma.taskLabel.findFirst({ where: { id: input.labelId, workspaceId }, select: { id: true } }))) throw new HttpError(400, "Label must belong to this workspace");

    const failed = tasks.map((task) => ({ task, error: bulkTaskFailure(subject, user.id, task, input.action, input.assigneeUserId) })).filter((item): item is { task: typeof tasks[number]; error: string } => Boolean(item.error)).map(({ task, error }) => ({ taskId: task.id, title: task.title, error }));
    const failedIds = new Set(failed.map((item) => item.taskId));
    const allowed = tasks.filter((task) => !failedIds.has(task.id));
    const recurringTasks: unknown[] = [];
    const assignmentNotificationIds: string[] = [];
    await prisma.$transaction(async (tx) => {
      for (const task of allowed) {
        if (input.action === "ADD_LABEL" || input.action === "REMOVE_LABEL") {
          await updateTaskLabelsWithinTransaction(tx, task, user.id, input.labelId!, input.action);
          continue;
        }
        const patch: TaskPatchInput = input.action === "ASSIGN" ? { assigneeUserId: input.assigneeUserId } : input.action === "STATUS" ? { status: input.status } : input.action === "PRIORITY" ? { priority: input.priority } : { dueAt: input.dueAt };
        const result = await updateTaskWithinTransaction(tx, task, patch, user);
        if (result.recurringTask) recurringTasks.push(result.recurringTask);
        if (result.assignmentNotificationId) assignmentNotificationIds.push(result.assignmentNotificationId);
      }
    });
    for (const notificationId of assignmentNotificationIds) after(() => deliverAssignmentNotification(notificationId));
    const updatedTasks = await findUpdatedTasks(allowed.map((task) => task.id));
    return Response.json({ requested: taskIds.length, updated: allowed.length, failed, tasks: updatedTasks.map(({ labelAssignments, ...task }) => ({ ...task, labels: labelAssignments.map(({ label }) => label) })), recurringTasks });
  } catch (error) { return error instanceof Response ? error : errorResponse(error); }
}
