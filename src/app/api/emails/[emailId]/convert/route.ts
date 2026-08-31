import { after } from "next/server";
import { buildEmailDeliverySubject } from "@/lib/email-delivery";
import { canAssignTaskTo } from "@/lib/permissions";
import { assertPermission, HttpError, errorResponse, requireMembership } from "@/lib/server/authorization";
import { deliverAssignmentNotification } from "@/lib/server/notification-service";
import { assertEmailVisible } from "@/lib/server/record-access";
import { prisma } from "@/lib/server/prisma";
import { emailConvertSchema, parseJson } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ emailId: string }> }) {
  try {
    const { emailId } = await params; const email = await prisma.inboundEmail.findUnique({ where: { id: emailId }, select: { id: true, workspaceId: true, connectorId: true, gmailThreadId: true, status: true, subject: true, internetMessageId: true } }); if (!email) throw new HttpError(404, "Email not found");
    const access = await requireMembership(email.workspaceId); assertPermission(access.subject, "EMAIL_TRIAGE"); assertPermission(access.subject, "TASK_CREATE"); await assertEmailVisible(emailId, email.workspaceId, access.user.id, access.user.email); const input = await parseJson(request, emailConvertSchema);
    if (!canAssignTaskTo(access.subject, access.user.id, input.assigneeUserId)) throw new HttpError(403, "You can only assign this task to yourself");
    const assignee = input.assigneeUserId ? await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: email.workspaceId, userId: input.assigneeUserId } }, select: { suspendedAt: true, user: { select: { email: true } } } }) : null;
    if (input.assigneeUserId && (!assignee || assignee.suspendedAt)) throw new HttpError(400, "Assignee must be an active member");
    const result = await prisma.$transaction(async (tx) => {
      const existingThreadTask = await tx.inboundEmail.findFirst({ where: { connectorId: email.connectorId, gmailThreadId: email.gmailThreadId, id: { not: emailId }, taskId: { not: null } }, select: { task: true }, orderBy: { createdAt: "asc" } });
      const existingMessageTask = email.internetMessageId ? await tx.inboundEmail.findFirst({ where: { workspaceId: email.workspaceId, id: { not: emailId }, internetMessageId: { equals: email.internetMessageId, mode: "insensitive" }, taskId: { not: null } }, select: { task: true }, orderBy: { createdAt: "asc" } }) : null;
      const existing = existingThreadTask || existingMessageTask;
      if (existing?.task) {
        const claimedDuplicate = await tx.inboundEmail.updateMany({ where: { id: emailId, status: "UNTRIAGED", taskId: null }, data: { status: "CONVERTED", taskId: existing.task.id, handledByUserId: access.user.id, handledAt: new Date() } });
        if (!claimedDuplicate.count) throw new HttpError(409, "This email has already been handled");
        await tx.activityEvent.create({ data: { workspaceId: email.workspaceId, taskId: existing.task.id, actorUserId: access.user.id, type: "DUPLICATE_EMAIL_LINKED_TO_TASK", detailsJson: { emailId, emailSubject: email.subject, originalTaskId: existing.task.id } } });
        return { task: existing.task, notificationId: null, deduplicated: true };
      }
      const claimed = await tx.inboundEmail.updateMany({ where: { id: emailId, status: "UNTRIAGED", taskId: null }, data: { status: "CONVERTED", handledByUserId: access.user.id, handledAt: new Date() } });
      if (!claimed.count) throw new HttpError(409, "This email has already been handled");
      const task = await tx.task.create({ data: { workspaceId: email.workspaceId, title: input.title, description: input.description || null, priority: input.priority, status: input.status, dueAt: input.dueAt ? new Date(input.dueAt) : null, startedAt: input.status === "IN_PROGRESS" ? new Date() : null, assigneeUserId: input.assigneeUserId, createdByUserId: access.user.id } });
      await tx.inboundEmail.update({ where: { id: emailId }, data: { taskId: task.id } });
      await tx.activityEvent.create({ data: { workspaceId: email.workspaceId, taskId: task.id, actorUserId: access.user.id, type: "TASK_CREATED_FROM_EMAIL", detailsJson: { emailId, emailSubject: email.subject } } });
      const notification = input.assigneeUserId && assignee ? await tx.notification.create({ data: { workspaceId: email.workspaceId, taskId: task.id, userId: input.assigneeUserId, type: "TASK_ASSIGNED", message: `${access.user.email} assigned you: ${task.title}`, emailTo: assignee.user.email, emailSubject: buildEmailDeliverySubject("TASK_ASSIGNED") } }) : null;
      return { task, notificationId: notification?.id };
    });
    if (result.notificationId) after(() => deliverAssignmentNotification(result.notificationId!));
    return Response.json(result.task, { status: result.deduplicated ? 200 : 201 });
  } catch (error) { return errorResponse(error); }
}
