import { errorResponse } from "@/lib/server/authorization";
import { requireEmailConnector } from "@/lib/server/email-connector-auth";
import { claimEmailWork } from "@/lib/server/email-automation";

export async function GET(request: Request, { params }: { params: Promise<{ connectorId: string }> }) {
  try {
    const { connectorId } = await params;
    const connector = await requireEmailConnector(request, connectorId);
    const work = await claimEmailWork(connector.workspaceId, request.url, 25);
    return Response.json({ work }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
