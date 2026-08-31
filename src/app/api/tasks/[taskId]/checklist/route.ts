import { randomUUID } from "node:crypto";
import { assertPermission, HttpError, errorResponse, requireMembership } from "@/lib/server/authorization";
import { assertTaskVisible } from "@/lib/server/record-access";
import { prisma } from "@/lib/server/prisma";
import { checklistItemSchema, parseJson } from "@/lib/validation";

export async function GET(_: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { workspaceId: true } });
    if (!task) throw new HttpError(404, "Task not found");
    const access = await requireMembership(task.workspaceId);
    await assertTaskVisible(taskId, task.workspaceId, access.user.id, access.user.email);
    return Response.json(await prisma.checklistItem.findMany({ where: { taskId }, orderBy: { position: "asc" } }));
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { workspaceId: true } });
    if (!task) throw new HttpError(404, "Task not found");
    const access = await requireMembership(task.workspaceId);
    await assertTaskVisible(taskId, task.workspaceId, access.user.id, access.user.email);
    assertPermission(access.subject, "TASK_CHECKLIST", "Checklist modification denied");
    const input = await parseJson(request, checklistItemSchema);
    const position = await prisma.checklistItem.count({ where: { taskId } });
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.checklistItem.create({ data: { id: randomUUID(), taskId, title: input.title, completed: input.completed ?? false, position } });
      await tx.activityEvent.create({ data: { workspaceId: task.workspaceId, taskId, actorUserId: access.user.id, type: "CHECKLIST_ITEM_ADDED", detailsJson: { itemId: created.id } } });
      return created;
    });
    return Response.json(item, { status: 201 });
  } catch (error) { return error instanceof Response ? error : errorResponse(error); }
}
