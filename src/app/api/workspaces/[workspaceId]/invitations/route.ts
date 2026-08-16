import { randomBytes } from "node:crypto";
import { canAssignWorkspaceRole } from "@/lib/permissions";
import { assertPermission, HttpError, errorResponse, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { invitationSchema, parseJson } from "@/lib/validation";

const safeInvitation = { id: true, email: true, role: true, expiresAt: true, createdAt: true } as const;

export async function GET(_: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    const { subject } = await requireMembership(workspaceId);
    assertPermission(subject, "MEMBER_INVITE", "Invitation access denied");
    return Response.json(await prisma.workspaceInvitation.findMany({ where: { workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } }, select: safeInvitation, orderBy: { createdAt: "desc" } }));
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    const { user, role, subject } = await requireMembership(workspaceId);
    assertPermission(subject, "MEMBER_INVITE", "Invitation creation denied");
    const input = await parseJson(request, invitationSchema);
    if (!canAssignWorkspaceRole(role, input.role)) throw new HttpError(403, "Cannot invite this role");
    const email = input.email.trim().toLowerCase();
    const token = randomBytes(24).toString("hex");
    const invitation = await prisma.workspaceInvitation.upsert({
      where: { workspaceId_email: { workspaceId, email } },
      update: { role: input.role, token, invitedByUserId: user.id, expiresAt: new Date(Date.now() + 7 * 86_400_000), acceptedAt: null, acceptedByUserId: null },
      create: { workspaceId, email, role: input.role, token, invitedByUserId: user.id, expiresAt: new Date(Date.now() + 7 * 86_400_000) },
      select: safeInvitation,
    });
    await prisma.activityEvent.create({ data: { workspaceId, actorUserId: user.id, type: "INVITATION_CREATED", detailsJson: { email, role: input.role } } });
    return Response.json(invitation, { status: 201 });
  } catch (error) { return error instanceof Response ? error : errorResponse(error); }
}
