import { hasPermission } from "@/lib/permissions";
import { errorResponse, HttpError, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { parseJson, savedTaskViewPatchSchema } from "@/lib/validation";

async function access(workspaceId: string, viewId: string) {
  const membership = await requireMembership(workspaceId); const view = await prisma.savedTaskView.findFirst({ where: { id: viewId, workspaceId } });
  if (!view) throw new HttpError(404, "Saved view not found");
  if (view.userId !== membership.user.id && !hasPermission(membership.subject, "WORKSPACE_MANAGE")) throw new HttpError(403, "Saved view management denied");
  return { ...membership, view };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ workspaceId: string; viewId: string }> }) {
  try { const { workspaceId, viewId } = await params; const { subject } = await access(workspaceId, viewId); const input = await parseJson(request, savedTaskViewPatchSchema); if (input.shared && !hasPermission(subject, "WORKSPACE_MANAGE")) throw new HttpError(403, "Only workspace managers can share views"); return Response.json(await prisma.savedTaskView.update({ where: { id: viewId }, data: input })); }
  catch (error) { return error instanceof Response ? error : errorResponse(error); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ workspaceId: string; viewId: string }> }) {
  try { const { workspaceId, viewId } = await params; await access(workspaceId, viewId); await prisma.savedTaskView.delete({ where: { id: viewId } }); return new Response(null, { status: 204 }); }
  catch (error) { return errorResponse(error); }
}
