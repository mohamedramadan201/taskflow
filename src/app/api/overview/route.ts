import { requireWorkspaceBySlug, errorResponse } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
export async function GET(request: Request) { try {
  const slug = new URL(request.url).searchParams.get("workspace");
  if (!slug) return Response.json({ error: "workspace is required" }, { status: 400 });
  const { workspace, role } = await requireWorkspaceBySlug(slug);
  const [tasks, members] = await Promise.all([
    prisma.task.findMany({ where: { workspaceId: workspace.id }, include: { assignee: { select: { id: true, name: true, email: true } }, createdBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.workspaceMember.findMany({ where: { workspaceId: workspace.id }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  return Response.json({ workspace, role, tasks, members });
} catch (e) { return errorResponse(e); } }
