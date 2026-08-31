import { after } from "next/server";
import { canAssignTaskTo, canDeleteTask, canModifyTask } from "@/lib/permissions";
import { HttpError, requireMembership, requireUser, errorResponse } from "@/lib/server/authorization";
import { deliverAssignmentNotification } from "@/lib/server/notification-service";
import { emailVisibilityWhere, taskVisibilityWhere } from "@/lib/server/record-access";
import { prisma } from "@/lib/server/prisma";
import { parseJson, taskPatchSchema } from "@/lib/validation";
import { updateTaskWithinTransaction } from "@/lib/server/task-update";

async function load(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new HttpError(404, "Task not found");
  const access = await requireMembership(task.workspaceId);
  const visibleWhere = await taskVisibilityWhere(task.workspaceId, access.user.id, access.user.email);
  const visible = await prisma.task.findFirst({ where: { AND: [{ id: taskId }, visibleWhere] }, select: { id: true } });
  if (!visible) throw new HttpError(404, "Task not found");
  return { task, access };
}

export async function GET(_: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const [{ taskId }, user] = await Promise.all([params, requireUser()]);
    const base = await prisma.task.findUnique({ where: { id: taskId }, select: { workspaceId: true } });
    if (!base) throw new HttpError(404, "Task not found");
    const access = await requireMembership(base.workspaceId);
    if (access.user.id !== user.id) throw new HttpError(403, "Task access denied");
    const visibleWhere = await taskVisibilityWhere(base.workspaceId, user.id, user.email);
    const visibleEmails = await emailVisibilityWhere(base.workspaceId, user.id, user.email);
    const detail = await prisma.task.findFirst({
      where: { AND: [{ id: taskId }, visibleWhere] },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        blockerTask: { select: { id: true, title: true, status: true } },
        sourceEmails: { where: visibleEmails, select: { id: true, subject: true, senderAddress: true, receivedAt: true, connector: { select: { mailboxAddress: true } } }, orderBy: { receivedAt: "desc" } },
        labelAssignments: { include: { label: true } },
        checklistItems: { orderBy: { position: "asc" } },
        comments: { include: { author: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } },
        activities: { include: { actor: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 30 },
      },
    });
    if (!detail) throw new HttpError(404, "Task not found");

    const visibleEmailIds = new Set(detail.sourceEmails.map((email) => email.id));
    const activities = detail.activities.map((activity) => {
      const details = activity.detailsJson;
      if (!details || typeof details !== "object" || Array.isArray(details)) return activity;
      const record = details as Record<string, unknown>;
      const emailId = typeof record.emailId === "string" ? record.emailId : null;
      if (!emailId || visibleEmailIds.has(emailId)) return activity;
      const { emailSubject: _emailSubject, senderAddress: _senderAddress, mailboxAddress: _mailboxAddress, ...safeDetails } = record;
      return { ...activity, detailsJson: { ...safeDetails, emailId: undefined, privateEmail: true } };
    });

    const { labelAssignments, activities: _activities, ...task } = detail;
    return Response.json({ ...task, activities, labels: labelAssignments.map(({ label }) => label) });
  } catch (e) { return errorResponse(e); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) { try {
  const { taskId } = await params; const { task, access } = await load(taskId); if (!canModifyTask(access.subject, access.user.id, task)) throw new HttpError(403, "Task modification denied");
  const input = await parseJson(request, taskPatchSchema);
  if (input.assigneeUserId !== undefined && input.assigneeUserId !== task.assigneeUserId && !canAssignTaskTo(access.subject, access.user.id, input.assigneeUserId)) throw new HttpError(403, "Task assignment denied");
  const updated = await prisma.$transaction(async (tx) => updateTaskWithinTransaction(tx, task, input, access.user));
  if (updated.assignmentNotificationId) after(() => deliverAssignmentNotification(updated.assignmentNotificationId!));
  return Response.json({ ...updated.updated, recurringTask: updated.recurringTask });
} catch (e) { return e instanceof Response ? e : errorResponse(e); } }

export async function DELETE(_: Request, { params }: { params: Promise<{ taskId: string }> }) { try {
  const { taskId } = await params; const { task, access } = await load(taskId); if (!canDeleteTask(access.subject, access.user.id, task)) throw new HttpError(403, "Task deletion denied");
  await prisma.$transaction([prisma.activityEvent.create({ data: { workspaceId: task.workspaceId, actorUserId: access.user.id, type: "TASK_DELETED", detailsJson: { taskId, title: task.title } } }), prisma.task.delete({ where: { id: taskId } })]); return new Response(null, { status: 204 });
} catch (e) { return errorResponse(e); } }
