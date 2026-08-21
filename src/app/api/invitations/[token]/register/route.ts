import { hash } from "bcryptjs";
import { HttpError, errorResponse } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { hashInvitationToken } from "@/lib/server/invitations";
import { consumeRateLimit, rateLimitResponse, requestClientKey } from "@/lib/server/rate-limit";
import { invitationRegistrationSchema, parseJson } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const tokenHash = hashInvitationToken(token);
    const rate = await consumeRateLimit(`invitation:register:ip:${requestClientKey(request)}`, 10);
    if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);
    const input = await parseJson(request, invitationRegistrationSchema);
    const tokenRate = await consumeRateLimit(`invitation:register:token:${tokenHash}`, 5);
    if (!tokenRate.allowed) return rateLimitResponse(tokenRate.retryAfterSeconds);
    const invitation = await prisma.workspaceInvitation.findUnique({ where: { tokenHash }, select: { id: true, email: true, role: true, workspaceId: true, expiresAt: true, acceptedAt: true } });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) throw new HttpError(404, "Invitation is invalid or expired");
    const passwordHash = await hash(input.password, 12);
    const existing = await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true, accountStatus: true } });
    if (existing && existing.accountStatus !== "PENDING") throw new HttpError(409, "An account already exists for this email. Sign in to accept the invitation.");
    if (existing) await prisma.user.update({ where: { id: existing.id }, data: { name: input.name, passwordHash, accountStatus: "ACTIVE" } });
    else await prisma.user.create({ data: { email: invitation.email, name: input.name, passwordHash, accountStatus: "ACTIVE" } });
    return Response.json({ created: true, email: invitation.email }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
