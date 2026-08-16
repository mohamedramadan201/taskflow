import { assertPermission, HttpError, errorResponse, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";

export async function DELETE(_: Request, { params }: { params: Promise<{ workspaceId: string; invitationId: string }> }) {
  try {
    const { workspaceId, invitationId } = await params;
    const access = await requireMembership(workspaceId);
    assertPermission(access.subject, "MEMBER_INVITE", "Invitation revocation denied");
    const invitation = await prisma.workspaceInvitation.findFirst({ where: { id: invitationId, workspaceId, acceptedAt: null }, select: { id: true, email: true } });
    if (!invitation) throw new HttpError(404, "Invitation not found");
    await prisma.$transaction([
      prisma.workspaceInvitation.delete({ where: { id: invitation.id } }),
      prisma.activityEvent.create({ data: { workspaceId, actorUserId: access.user.id, type: "INVITATION_REVOKED", detailsJson: { invitationId, email: invitation.email } } }),
    ]);
    return new Response(null, { status: 204 });
  } catch (error) { return errorResponse(error); }
}
