import { after } from "next/server";
import { buildEmailDeliverySubject } from "@/lib/email-delivery";
import { deliverAssignmentNotification } from "@/lib/server/notification-service";
import { HttpError, errorResponse, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { parseJson, taskAssignmentSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params; const input = await parseJson(request, taskAssignmentSchema);
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true, title: true, workspaceId: true, assigneeUserId: true } });
    if (!task) throw new HttpError(404, "Task not found");
    const { user } = await requireMembership(task.workspaceId);
    const target = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: task.workspaceId, userId: input.assigneeUserId } }, select: { userId: true, suspendedAt: true, user: { select: { email: true } } } });
    if (!target || target.suspendedAt) throw new HttpError(400, "Assignee must be an active member of this workspace");
    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.task.updateMany({ where: { id: taskId, workspaceId: task.workspaceId, assigneeUserId: null }, data: { assigneeUserId: target.userId } });
      if (claimed.count !== 1) throw new HttpError(409, "This task has already been assigned. Refresh the board to see its owner.");
      const updated = await tx.task.findUniqueOrThrow({ where: { id: taskId }, include: { assignee: { select: { id: true, name: true, email: true } } } });
      const notification = await tx.notification.create({ data: { workspaceId: task.workspaceId, taskId, userId: target.userId, type: "TASK_ASSIGNED", message: `${user.email} assigned you: ${task.title}`, emailTo: target.user.email, emailSubject: buildEmailDeliverySubject("TASK_ASSIGNED") } });
      await tx.activityEvent.create({ data: { workspaceId: task.workspaceId, taskId, actorUserId: user.id, type: "TASK_ASSIGNED", detailsJson: { assigneeUserId: target.userId, previousAssigneeUserId: null } } });
      return { updated, notificationId: notification.id };
    });
    after(() => deliverAssignmentNotification(result.notificationId));
    return Response.json(result.updated);
  } catch (error) { return error instanceof Response ? error : errorResponse(error); }
}
