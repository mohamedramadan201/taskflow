import { assertPermission, errorResponse, requireWorkspaceOwner } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    const access = await requireWorkspaceOwner(workspaceId);
    assertPermission(access.subject, "AUDIT_VIEW", "Audit log access denied");
    const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit")) || 50, 1), 100);
    const events = await prisma.activityEvent.findMany({
      where: { workspaceId },
      select: { id: true, type: true, detailsJson: true, createdAt: true, actor: { select: { id: true, name: true, email: true } }, task: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return Response.json(events);
  } catch (error) { return errorResponse(error); }
}
