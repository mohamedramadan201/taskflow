import { assertPermission, errorResponse, HttpError, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";

export async function DELETE(_: Request, { params }: { params: Promise<{ workspaceId: string; teamGroupId: string }> }) {
  try {
    const { workspaceId, teamGroupId } = await params;
    const { user, subject } = await requireMembership(workspaceId);
    assertPermission(subject, "MEMBER_MANAGE", "Team group management denied");
    const teamGroup = await prisma.teamGroup.findFirst({ where: { id: teamGroupId, workspaceId }, select: { id: true, name: true } });
    if (!teamGroup) throw new HttpError(404, "Team group not found");
    await prisma.$transaction([
      prisma.teamGroup.delete({ where: { id: teamGroup.id } }),
      prisma.activityEvent.create({ data: { workspaceId, actorUserId: user.id, type: "TEAM_GROUP_DELETED", detailsJson: { teamGroupId: teamGroup.id, name: teamGroup.name } } }),
    ]);
    return new Response(null, { status: 204 });
  } catch (error) { return error instanceof Response ? error : errorResponse(error); }
}
