import { assertPermission, HttpError, errorResponse, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { emailBulkActionSchema, parseJson } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, emailBulkActionSchema);
    const requestedWorkspaceId = input.workspaceId;
    if (input.selectAll && !requestedWorkspaceId) throw new HttpError(400, "Workspace selection is required");
    const emails = await prisma.inboundEmail.findMany({
      where: input.selectAll ? { workspaceId: requestedWorkspaceId!, status: "UNTRIAGED" } : { id: { in: input.emailIds } },
      select: { id: true, workspaceId: true, status: true, subject: true },
    });
    if (!emails.length) throw new HttpError(404, "No matching emails were found");
    if (!input.selectAll && emails.length !== input.emailIds!.length) throw new HttpError(404, "One or more emails could not be found");
    const workspaceId = emails[0].workspaceId;
    if (input.selectAll && workspaceId !== requestedWorkspaceId) throw new HttpError(400, "Workspace selection is invalid");
    if (emails.some((email) => email.workspaceId !== workspaceId)) throw new HttpError(400, "Emails must belong to one workspace");
    const selectedEmailIds = emails.map((email) => email.id);
    const access = await requireMembership(workspaceId);
    assertPermission(access.subject, "EMAIL_TRIAGE");
    if (emails.some((email) => email.status === "CONVERTED")) throw new HttpError(409, "Converted emails cannot be moved in bulk");

    if (input.action === "DELETE") {
      if (emails.some((email) => email.status === "CONVERTED")) throw new HttpError(409, "Converted emails cannot be deleted because they are linked to task history");
      const deleted = await prisma.$transaction(async (tx) => {
        const result = await tx.inboundEmail.deleteMany({ where: { id: { in: selectedEmailIds }, workspaceId, status: { not: "CONVERTED" } } });
        if (result.count) await tx.activityEvent.createMany({ data: emails.slice(0, result.count).map((email) => ({ workspaceId, actorUserId: access.user.id, type: "INBOUND_EMAIL_DELETED", detailsJson: { emailId: email.id, emailSubject: email.subject } })) });
        return result;
      });
      return Response.json({ count: deleted.count, action: input.action });
    }

    if (input.action === "ASSIGN") {
      const assigneeUserId = input.assigneeUserId;
      if (!assigneeUserId) throw new HttpError(400, "Choose a member to assign these emails to");
      const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: assigneeUserId } }, select: { suspendedAt: true, user: { select: { email: true } } } });
      if (!member || member.suspendedAt) throw new HttpError(400, "Assignee must be an active workspace member");
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.inboundEmail.updateMany({ where: { id: { in: selectedEmailIds }, workspaceId, status: { not: "CONVERTED" } }, data: { handledByUserId: assigneeUserId, handledAt: null } });
        if (assigneeUserId !== access.user.id) await tx.notification.create({ data: { workspaceId, userId: assigneeUserId, type: "SYSTEM", message: `${access.user.email} assigned you ${result.count} email${result.count === 1 ? "" : "s"}`, emailStatus: "SKIPPED" } });
        return result;
      });
      return Response.json({ count: updated.count, action: input.action });
    }

    const status = input.action === "DISMISS" ? "DISMISSED" : input.action === "NO_ACTION_NEEDED" ? "NO_ACTION_NEEDED" : "UNTRIAGED";
    const handled = status !== "UNTRIAGED";
    const updated = await prisma.inboundEmail.updateMany({ where: { id: { in: selectedEmailIds }, workspaceId, status: { not: "CONVERTED" } }, data: { status, handledAt: handled ? new Date() : null, handledByUserId: handled ? access.user.id : null } });
    return Response.json({ count: updated.count, action: input.action });
  } catch (error) { return errorResponse(error); }
}
