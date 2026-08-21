import { errorResponse } from "@/lib/server/authorization";
import { requireEmailConnector } from "@/lib/server/email-connector-auth";
import { completeEmailWork } from "@/lib/server/email-automation";
import { prisma } from "@/lib/server/prisma";
import { automationEmailResultSchema, parseJson } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ connectorId: string }> }) {
  try {
    const { connectorId } = await params;
    const connector = await requireEmailConnector(request, connectorId);
    const input = await parseJson(request, automationEmailResultSchema);
    const result = await completeEmailWork(connector.workspaceId, input);
    await prisma.emailConnector.update({ where: { id: connector.id }, data: { lastHeartbeatAt: new Date(), lastError: input.success ? null : input.error } });
    return Response.json(result);
  } catch (error) { return errorResponse(error); }
}
