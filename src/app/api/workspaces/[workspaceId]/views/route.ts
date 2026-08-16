import { hasPermission } from "@/lib/permissions";
import { errorResponse, HttpError, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { parseJson, savedTaskViewSchema } from "@/lib/validation";

export async function GET(_: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try { const { workspaceId } = await params; const { user } = await requireMembership(workspaceId); return Response.json(await prisma.savedTaskView.findMany({ where: { workspaceId, OR: [{ userId: user.id }, { shared: true }] }, orderBy: [{ shared: "desc" }, { name: "asc" }] })); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params; const { user, subject } = await requireMembership(workspaceId); const input = await parseJson(request, savedTaskViewSchema);
    if (input.shared && !hasPermission(subject, "WORKSPACE_MANAGE")) throw new HttpError(403, "Only workspace managers can create shared views");
    const view = await prisma.savedTaskView.create({ data: { workspaceId, userId: user.id, name: input.name, shared: input.shared, filters: input.filters } });
    return Response.json(view, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
