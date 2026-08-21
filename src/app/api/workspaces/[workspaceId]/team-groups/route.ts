import { assertPermission, errorResponse, requireWorkspaceOwner, HttpError } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { parseJson, teamGroupSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    const { user, subject } = await requireWorkspaceOwner(workspaceId);
    assertPermission(subject, "MEMBER_MANAGE", "Team group management denied");
    const input = await parseJson(request, teamGroupSchema);
    const existing = await prisma.teamGroup.findFirst({ where: { workspaceId, name: { equals: input.name, mode: "insensitive" } }, select: { id: true } });
    if (existing) throw new HttpError(409, "A team group with this name already exists");
    const teamGroup = await prisma.$transaction(async (tx) => {
      const created = await tx.teamGroup.create({ data: { workspaceId, name: input.name } });
      await tx.activityEvent.create({ data: { workspaceId, actorUserId: user.id, type: "TEAM_GROUP_CREATED", detailsJson: { teamGroupId: created.id, name: created.name } } });
      return created;
    });
    return Response.json({ ...teamGroup, _count: { members: 0 } }, { status: 201 });
  } catch (error) { return error instanceof Response ? error : errorResponse(error); }
}
