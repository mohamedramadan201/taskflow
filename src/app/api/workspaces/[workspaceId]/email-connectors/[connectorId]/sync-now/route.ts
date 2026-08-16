import { assertPermission, HttpError, errorResponse, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";

export async function POST(_: Request, { params }: { params: Promise<{ workspaceId: string; connectorId: string }> }) {
  try {
    const { workspaceId, connectorId } = await params; const access = await requireMembership(workspaceId); assertPermission(access.subject, "EMAIL_CONNECTOR_MANAGE");
    const result = await prisma.emailConnector.updateMany({ where: { id: connectorId, workspaceId }, data: { syncRequestedAt: new Date(), lastError: null } });
    if (!result.count) throw new HttpError(404, "Email connection not found");
    return Response.json({ queued: true });
  } catch (error) { return errorResponse(error); }
}
