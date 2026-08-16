import { createConnectorToken, hashConnectorToken } from "@/lib/email-connectors";
import { assertPermission, errorResponse, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { taskflowPublicUrl } from "@/lib/public-app-url";
import { emailConnectorInputSchema, parseJson } from "@/lib/validation";

export async function GET(_: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params; const access = await requireMembership(workspaceId); assertPermission(access.subject, "EMAIL_CONNECTOR_MANAGE");
    const connectors = await prisma.emailConnector.findMany({ where: { workspaceId }, omit: { tokenHash: true }, include: { filters: { orderBy: { createdAt: "asc" } }, _count: { select: { emails: true } } }, orderBy: { createdAt: "asc" } });
    return Response.json(connectors);
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params; const access = await requireMembership(workspaceId); assertPermission(access.subject, "EMAIL_CONNECTOR_MANAGE");
    const input = await parseJson(request, emailConnectorInputSchema); const token = createConnectorToken();
    const connector = await prisma.$transaction(async (tx) => {
      const created = await tx.emailConnector.create({ data: { workspaceId, mailboxAddress: input.mailboxAddress, displayName: input.displayName || null, syncIntervalMinutes: input.syncIntervalMinutes, tokenHash: hashConnectorToken(token), createdByUserId: access.user.id } });
      await tx.activityEvent.create({ data: { workspaceId, actorUserId: access.user.id, type: "EMAIL_CONNECTOR_CREATED", detailsJson: { connectorId: created.id, mailboxAddress: created.mailboxAddress } } });
      return created;
    });
    const publicUrl = taskflowPublicUrl(request.url);
    return Response.json({ ...connector, tokenHash: undefined, connectorToken: token, setup: { connectorId: connector.id, connectorToken: token, taskflowBaseUrl: publicUrl, requiresPublicUrl: !publicUrl } }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
