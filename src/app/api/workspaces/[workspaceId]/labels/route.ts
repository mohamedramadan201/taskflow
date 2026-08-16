import { hasPermission } from "@/lib/permissions";
import { errorResponse, HttpError, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { labelSchema, parseJson } from "@/lib/validation";

export async function GET(_: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try { const { workspaceId } = await params; await requireMembership(workspaceId); return Response.json(await prisma.taskLabel.findMany({ where: { workspaceId }, orderBy: { name: "asc" } })); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params; const { user, subject } = await requireMembership(workspaceId);
    if (!hasPermission(subject, "WORKSPACE_MANAGE")) throw new HttpError(403, "Only workspace managers can create labels");
    const input = await parseJson(request, labelSchema);
    const label = await prisma.$transaction(async (tx) => {
      const created = await tx.taskLabel.create({ data: { workspaceId, ...input } });
      await tx.activityEvent.create({ data: { workspaceId, actorUserId: user.id, type: "TASK_LABEL_CREATED", detailsJson: { labelId: created.id, name: created.name } } });
      return created;
    });
    return Response.json(label, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
