import { assertPermission, HttpError, errorResponse, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { emailLinkSchema, parseJson } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ emailId: string }> }) {
  try {
    const { emailId } = await params; const email = await prisma.inboundEmail.findUnique({ where: { id: emailId }, select: { workspaceId: true, status: true, subject: true } }); if (!email) throw new HttpError(404, "Email not found");
    const access = await requireMembership(email.workspaceId); assertPermission(access.subject, "EMAIL_TRIAGE"); const input = await parseJson(request, emailLinkSchema);
    const task = await prisma.task.findFirst({ where: { id: input.taskId, workspaceId: email.workspaceId }, select: { id: true, title: true } }); if (!task) throw new HttpError(404, "Task not found");
    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.inboundEmail.updateMany({ where: { id: emailId, status: "UNTRIAGED", taskId: null }, data: { status: "CONVERTED", taskId: task.id, handledAt: new Date(), handledByUserId: access.user.id } });
      if (!claimed.count) throw new HttpError(409, "This email has already been handled");
      await tx.activityEvent.create({ data: { workspaceId: email.workspaceId, taskId: task.id, actorUserId: access.user.id, type: "EMAIL_LINKED_TO_TASK", detailsJson: { emailId, emailSubject: email.subject } } });
      return tx.inboundEmail.findUniqueOrThrow({ where: { id: emailId }, include: { task: { select: { id: true, title: true } } } });
    });
    return Response.json(updated);
  } catch (error) { return errorResponse(error); }
}
