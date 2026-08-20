import { hash } from "bcryptjs";
import { HttpError, errorResponse } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { invitationRegistrationSchema, parseJson } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const input = await parseJson(request, invitationRegistrationSchema);
    const invitation = await prisma.workspaceInvitation.findUnique({ where: { token }, select: { id: true, email: true, role: true, workspaceId: true, expiresAt: true, acceptedAt: true } });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) throw new HttpError(404, "Invitation is invalid or expired");
    if (await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } })) throw new HttpError(409, "An account already exists for this email. Sign in to accept the invitation.");
    const passwordHash = await hash(input.password, 12);
    await prisma.user.create({ data: { email: invitation.email, name: input.name, passwordHash } });
    return Response.json({ created: true, email: invitation.email }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
