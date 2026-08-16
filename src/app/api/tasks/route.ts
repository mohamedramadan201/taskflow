import { after } from "next/server";
import { buildEmailDeliverySubject } from "@/lib/email-delivery";
import { canAssignTaskTo } from "@/lib/permissions";
import { assertPermission, HttpError, requireMembership, errorResponse } from "@/lib/server/authorization";
import { deliverAssignmentNotification } from "@/lib/server/notification-service";
import { prisma } from "@/lib/server/prisma";
import { parseJson, taskInputSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, taskInputSchema); const { user, subject } = await requireMembership(input.workspaceId);
    assertPermission(subject, "TASK_CREATE", "Task creation denied");
    if (!canAssignTaskTo(subject, user.id, input.assigneeUserId)) throw new HttpError(403, "You can only assign a new task to yourself");
    const assignee = input.assigneeUserId ? await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.assigneeUserId } }, select: { suspendedAt: true, user: { select: { email: true } } } }) : null;
    if (input.assigneeUserId && (!assignee || assignee.suspendedAt)) throw new HttpError(400, "Assignee must be an active member of this workspace");
    if (input.blockerTaskId && !(await prisma.task.findFirst({ where: { id: input.blockerTaskId, workspaceId: input.workspaceId }, select: { id: true } }))) throw new HttpError(400, "Blocking task must belong to this workspace");
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({ data: { workspaceId: input.workspaceId, title: input.title, description: input.description, status: input.status, priority: input.priority, dueAt: input.dueAt ? new Date(input.dueAt) : null, startedAt: input.status === "IN_PROGRESS" || input.status === "DONE" ? new Date() : null, completedAt: input.status === "DONE" ? new Date() : null, estimatedMinutes: input.estimatedMinutes, remainingMinutes: input.remainingMinutes ?? input.estimatedMinutes, actualMinutes: input.actualMinutes, blockedReason: input.blockedReason, blockerTaskId: input.blockerTaskId, blockedAt: input.blockedReason || input.blockerTaskId ? new Date() : null, updatedProductsCount: input.updatedProductsCount, newProductsCount: input.newProductsCount, updatedImagesCount: input.updatedImagesCount, newImagesCount: input.newImagesCount, assigneeUserId: input.assigneeUserId, createdByUserId: user.id } });
      await tx.activityEvent.create({ data: { workspaceId: input.workspaceId, taskId: created.id, actorUserId: user.id, type: "TASK_CREATED", detailsJson: { title: created.title } } });
      const notification = input.assigneeUserId && assignee ? await tx.notification.create({ data: { workspaceId: input.workspaceId, taskId: created.id, userId: input.assigneeUserId, type: "TASK_ASSIGNED", message: `${user.email} assigned you: ${created.title}`, emailTo: assignee.user.email, emailSubject: buildEmailDeliverySubject("TASK_ASSIGNED") } }) : null;
      return { created, notificationId: notification?.id };
    });
    if (result.notificationId) after(() => deliverAssignmentNotification(result.notificationId!));
    return Response.json(result.created, { status: 201 });
  } catch (error) { return error instanceof Response ? error : errorResponse(error); }
}
