import { auth } from "@/auth";
import { InviteClient } from "@/components/invite-client";
import { prisma } from "@/lib/server/prisma";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [session, invitation] = await Promise.all([
    auth(),
    prisma.workspaceInvitation.findUnique({ where: { token }, select: { email: true, role: true, expiresAt: true, acceptedAt: true, workspace: { select: { name: true, slug: true } } } }),
  ]);
  const valid = invitation && !invitation.acceptedAt && invitation.expiresAt > new Date();
  return <main className="invite-page"><div className="brand invite-brand"><span>TF</span><strong>TaskFlow</strong></div><InviteClient invitation={valid ? { token, email: invitation.email, role: invitation.role, workspace: invitation.workspace, sessionEmail: session?.user?.email } : null} /></main>;
}
