import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { parseJson } from "@/lib/validation";

const reorderSchema = z.object({ workspaceIds: z.array(z.string().trim().min(1)).min(1).max(100) });

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { workspaceIds } = await parseJson(request, reorderSchema);
    if (new Set(workspaceIds).size !== workspaceIds.length) throw new HttpError(400, "Workspace order contains duplicates");
    const memberships = await prisma.workspaceMember.findMany({ where: { userId: user.id, suspendedAt: null }, select: { workspaceId: true } });
    const allowedIds = new Set(memberships.map((membership) => membership.workspaceId));
    if (workspaceIds.length !== allowedIds.size || workspaceIds.some((workspaceId) => !allowedIds.has(workspaceId))) throw new HttpError(400, "Workspace order is out of date. Refresh and try again.");
    await prisma.$transaction(workspaceIds.map((workspaceId, sidebarOrder) => prisma.workspaceMember.update({ where: { workspaceId_userId: { workspaceId, userId: user.id } }, data: { sidebarOrder } })));
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
