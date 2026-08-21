import { randomBytes } from "node:crypto";
import { getEmailDeliveryConfig } from "@/lib/email-delivery";
import { taskflowPublicUrl } from "@/lib/public-app-url";
import { canAssignWorkspaceRole } from "@/lib/permissions";
import { sendWorkspaceInvitationEmail } from "@/lib/server/email-provider";
import { assertPermission, errorResponse, HttpError, requireWorkspaceOwner } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { hashInvitationToken } from "@/lib/server/invitations";

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string; memberUserId: string }> }) {
  try {
    const { workspaceId, memberUserId } = await params;
    const access = await requireWorkspaceOwner(workspaceId);
    assertPermission(access.subject, "MEMBER_MANAGE", "Member activation denied");
    const target = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: memberUserId } }, include: { user: { select: { email: true, accountStatus: true } }, teamGroup: { select: { id: true, name: true } } } });
    if (!target) throw new HttpError(404, "Member not found");
    if (access.role === "ADMIN" && (target.role === "OWNER" || target.role === "ADMIN")) throw new HttpError(403, "Admins cannot activate owners or admins");
    if (target.user.accountStatus !== "PENDING") throw new HttpError(409, "This account is already active");
    if (!canAssignWorkspaceRole(access.role, target.role)) throw new HttpError(403, "Cannot activate this role");
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
    if (!workspace) throw new HttpError(404, "Workspace not found");
    const token = randomBytes(24).toString("hex");
    const invitation = await prisma.workspaceInvitation.upsert({
      where: { workspaceId_email: { workspaceId, email: target.user.email } },
      update: { role: target.role, teamGroupId: target.teamGroupId, tokenHash: hashInvitationToken(token), invitedByUserId: access.user.id, expiresAt: new Date(Date.now() + 7 * 86_400_000), acceptedAt: null, acceptedByUserId: null, emailStatus: "PENDING", emailSentAt: null, emailAttempts: 0, emailLastError: null, emailClaimedAt: null },
      create: { workspaceId, email: target.user.email, role: target.role, teamGroupId: target.teamGroupId, tokenHash: hashInvitationToken(token), invitedByUserId: access.user.id, expiresAt: new Date(Date.now() + 7 * 86_400_000), emailStatus: "PENDING" },
      select: { id: true, email: true, role: true, teamGroupId: true, expiresAt: true, emailStatus: true, emailSentAt: true },
    });
    let emailQueued = false;
    let emailSent = false;
    try {
      const publicUrl = taskflowPublicUrl(request.url);
      if (!publicUrl) throw new Error("TASKFLOW_PUBLIC_URL is not configured");
      if (getEmailDeliveryConfig().mode === "apps_script") emailQueued = true;
      else {
        await sendWorkspaceInvitationEmail({ to: target.user.email, token, workspaceName: workspace.name, role: target.role, inviterName: access.user.email, publicUrl });
        emailSent = true;
        await prisma.workspaceInvitation.update({ where: { id: invitation.id }, data: { emailStatus: "SENT", emailSentAt: new Date(), emailAttempts: { increment: 1 }, emailLastError: null } });
      }
    } catch (error) {
      await prisma.workspaceInvitation.update({ where: { id: invitation.id }, data: { emailStatus: "FAILED", emailAttempts: { increment: 1 }, emailLastError: error instanceof Error ? error.message.slice(0, 500) : "Delivery failed" } });
    }
    await prisma.activityEvent.create({ data: { workspaceId, actorUserId: access.user.id, type: "MEMBER_ACTIVATION_SENT", detailsJson: { targetUserId: memberUserId, invitationId: invitation.id, teamGroupId: target.teamGroupId } } });
    return Response.json({ ...invitation, emailStatus: emailSent ? "SENT" : emailQueued ? "PENDING" : "FAILED", emailSent, emailQueued });
  } catch (error) { return errorResponse(error); }
}
