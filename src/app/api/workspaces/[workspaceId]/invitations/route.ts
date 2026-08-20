import { randomBytes } from "node:crypto";
import { canAssignWorkspaceRole } from "@/lib/permissions";
import { getEmailDeliveryConfig } from "@/lib/email-delivery";
import { assertPermission, HttpError, errorResponse, requireMembership } from "@/lib/server/authorization";
import { sendWorkspaceInvitationEmail } from "@/lib/server/email-provider";
import { prisma } from "@/lib/server/prisma";
import { taskflowPublicUrl } from "@/lib/public-app-url";
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
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
    if (!workspace) throw new HttpError(404, "Workspace not found");
    const invitation = await prisma.workspaceInvitation.upsert({
      where: { workspaceId_email: { workspaceId, email } },
      update: { role: input.role, token, invitedByUserId: user.id, expiresAt: new Date(Date.now() + 7 * 86_400_000), acceptedAt: null, acceptedByUserId: null },
      create: { workspaceId, email, role: input.role, token, invitedByUserId: user.id, expiresAt: new Date(Date.now() + 7 * 86_400_000) },
      select: safeInvitation,
    });
    await prisma.activityEvent.create({ data: { workspaceId, actorUserId: user.id, type: "INVITATION_CREATED", detailsJson: { email, role: input.role } } });
    let emailSent = false;
    try {
      const publicUrl = taskflowPublicUrl(request.url);
      if (getEmailDeliveryConfig().mode !== "smtp") throw new Error("SMTP email delivery is not configured");
      if (!publicUrl) throw new Error("TASKFLOW_PUBLIC_URL is not configured");
      await sendWorkspaceInvitationEmail({ to: email, token, workspaceName: workspace.name, role: input.role, inviterName: user.email, publicUrl });
      emailSent = true;
    } catch (error) {
      console.error("[TaskFlow invitation email] Delivery failed", error);
    }
    return Response.json({ ...invitation, emailSent, message: emailSent ? "Invitation email sent" : "Invitation created, but the email could not be sent. Check SMTP configuration." }, { status: 201 });
  } catch (error) { return error instanceof Response ? error : errorResponse(error); }
}
