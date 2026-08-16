import { createConnectorToken, hashConnectorToken } from "@/lib/email-connectors";
import { assertPermission, HttpError, errorResponse, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { taskflowPublicUrl } from "@/lib/public-app-url";

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string; connectorId: string }> }) {
  try {
    const { workspaceId, connectorId } = await params; const access = await requireMembership(workspaceId); assertPermission(access.subject, "EMAIL_CONNECTOR_MANAGE");
    const existing = await prisma.emailConnector.findFirst({ where: { id: connectorId, workspaceId }, select: { id: true, mailboxAddress: true } }); if (!existing) throw new HttpError(404, "Email connection not found");
    const token = createConnectorToken();
    await prisma.$transaction([
      prisma.emailConnector.update({ where: { id: connectorId }, data: { tokenHash: hashConnectorToken(token), configVersion: { increment: 1 }, lastError: null, syncRequestedAt: new Date() } }),
      prisma.activityEvent.create({ data: { workspaceId, actorUserId: access.user.id, type: "EMAIL_CONNECTOR_SETUP_REGENERATED", detailsJson: { connectorId, mailboxAddress: existing.mailboxAddress } } }),
    ]);
    const publicUrl = taskflowPublicUrl(request.url);
    return Response.json({ setup: { connectorId, connectorToken: token, taskflowBaseUrl: publicUrl, requiresPublicUrl: !publicUrl } });
  } catch (error) { return errorResponse(error); }
}
