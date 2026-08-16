import { assertPermission, HttpError, errorResponse, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { commentSchema, parseJson } from "@/lib/validation";

export async function GET(_: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { workspaceId: true } });
    if (!task) throw new HttpError(404, "Task not found");
    await requireMembership(task.workspaceId);
    const comments = await prisma.comment.findMany({ where: { taskId }, include: { author: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } });
    return Response.json(comments);
  } catch (e) { return errorResponse(e); }
}

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true, workspaceId: true, createdByUserId: true, assigneeUserId: true } });
    if (!task) throw new HttpError(404, "Task not found");
    const access = await requireMembership(task.workspaceId);
    assertPermission(access.subject, "TASK_COMMENT", "Comment creation denied");
    const { user } = access;
    const input = await parseJson(request, commentSchema);
    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({ data: { taskId, workspaceId: task.workspaceId, authorUserId: user.id, body: input.body }, include: { author: { select: { id: true, name: true, email: true } } } });
      await tx.activityEvent.create({ data: { workspaceId: task.workspaceId, taskId, actorUserId: user.id, type: "COMMENT_ADDED", detailsJson: { commentId: created.id } } });
      return created;
    });
    return Response.json(comment, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
