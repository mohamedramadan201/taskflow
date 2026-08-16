import { assertPermission, HttpError, errorResponse, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { emailActionSchema, parseJson } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ emailId: string }> }) {
  try {
    const { emailId } = await params; const email = await prisma.inboundEmail.findUnique({ where: { id: emailId }, select: { workspaceId: true, status: true } }); if (!email) throw new HttpError(404, "Email not found");
    const access = await requireMembership(email.workspaceId); assertPermission(access.subject, "EMAIL_TRIAGE"); const input = await parseJson(request, emailActionSchema);
    if (email.status === "CONVERTED") throw new HttpError(409, "Converted emails cannot be dismissed or restored");
    const updated = await prisma.inboundEmail.update({ where: { id: emailId }, data: { status: input.status, handledAt: input.status === "DISMISSED" ? new Date() : null, handledByUserId: input.status === "DISMISSED" ? access.user.id : null } });
    return Response.json(updated);
  } catch (error) { return errorResponse(error); }
}
