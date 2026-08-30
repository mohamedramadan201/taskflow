import { assertPermission, HttpError, errorResponse, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { emailActionSchema, parseJson } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ emailId: string }> }) {
  try {
    const { emailId } = await params; const email = await prisma.inboundEmail.findUnique({ where: { id: emailId }, select: { workspaceId: true, connectorId: true, gmailThreadId: true, status: true } }); if (!email) throw new HttpError(404, "Email not found");
    const access = await requireMembership(email.workspaceId); assertPermission(access.subject, "EMAIL_TRIAGE"); const input = await parseJson(request, emailActionSchema);
    if (email.status === "CONVERTED") throw new HttpError(409, "Converted emails cannot be moved");
    const handled = input.status === "DISMISSED" || input.status === "NO_ACTION_NEEDED";
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.inboundEmail.update({ where: { id: emailId }, data: { status: input.status, handledAt: handled ? new Date() : null, handledByUserId: handled ? access.user.id : null } });
      const monitor = await tx.emailMonitorThread.findUnique({ where: { connectorId_gmailThreadId: { connectorId: email.connectorId, gmailThreadId: email.gmailThreadId } } });
      if (monitor && handled) await tx.emailMonitorThread.update({ where: { id: monitor.id }, data: { status: "NO_ACTION_NEEDED", manualNoActionAt: new Date(), manualNoActionMessageAt: monitor.latestExternalMessageAt } });
      if (monitor && input.status === "UNTRIAGED") await tx.emailMonitorThread.update({ where: { id: monitor.id }, data: { status: "WAITING", manualNoActionAt: null, manualNoActionMessageAt: null } });
      return result;
    });
    return Response.json(updated);
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ emailId: string }> }) {
  try {
    const { emailId } = await params; const email = await prisma.inboundEmail.findUnique({ where: { id: emailId }, select: { workspaceId: true, status: true, subject: true } }); if (!email) throw new HttpError(404, "Email not found");
    const access = await requireMembership(email.workspaceId); assertPermission(access.subject, "EMAIL_TRIAGE");
    if (email.status === "CONVERTED") throw new HttpError(409, "Converted emails cannot be deleted because they are linked to task history");
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.inboundEmail.deleteMany({ where: { id: emailId, workspaceId: email.workspaceId, status: { not: "CONVERTED" } } });
      if (!deleted.count) throw new HttpError(409, "This email has already been handled");
      await tx.activityEvent.create({ data: { workspaceId: email.workspaceId, actorUserId: access.user.id, type: "INBOUND_EMAIL_DELETED", detailsJson: { emailId, emailSubject: email.subject } } });
    });
    return Response.json({ deleted: true, emailId });
  } catch (error) { return errorResponse(error); }
}
