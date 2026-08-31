import { requireWorkspaceBySlug, errorResponse } from "@/lib/server/authorization";
import { taskVisibilityWhere } from "@/lib/server/record-access";
import { prisma } from "@/lib/server/prisma";
const OVERVIEW_TASK_LIMIT = 200;
export async function GET(request: Request) { try {
  const slug = new URL(request.url).searchParams.get("workspace");
  if (!slug) return Response.json({ error: "workspace is required" }, { status: 400 });
  const { workspace, role, user } = await requireWorkspaceBySlug(slug);
  const visibleTasks = await taskVisibilityWhere(workspace.id, user.id, user.email);
  const [tasks, members] = await Promise.all([
    prisma.task.findMany({ where: visibleTasks, include: { assignee: { select: { id: true, name: true, email: true } }, createdBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: OVERVIEW_TASK_LIMIT }),
    prisma.workspaceMember.findMany({ where: { workspaceId: workspace.id }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  return Response.json({ workspace, role, tasks, members });
} catch (e) { return errorResponse(e); } }
