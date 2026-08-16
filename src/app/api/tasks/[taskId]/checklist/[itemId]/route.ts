import { z } from "zod";
import { assertPermission, HttpError, errorResponse, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { parseJson } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string; itemId: string }> }) {
  try {
    const { taskId, itemId } = await params;
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { workspaceId: true } });
    if (!task) throw new HttpError(404, "Task not found");
    const access = await requireMembership(task.workspaceId);
    assertPermission(access.subject, "TASK_CHECKLIST", "Checklist modification denied");
    const existing = await prisma.checklistItem.findFirst({ where: { id: itemId, taskId }, select: { id: true } });
    if (!existing) throw new HttpError(404, "Checklist item not found");
    const input = await parseJson(request, z.object({ title: z.string().trim().min(1).max(200).optional(), completed: z.boolean().optional() }).refine((value) => Object.keys(value).length > 0, "A checklist change is required"));
    const item = await prisma.checklistItem.update({ where: { id: itemId }, data: input });
    await prisma.activityEvent.create({ data: { workspaceId: task.workspaceId, taskId, actorUserId: access.user.id, type: "CHECKLIST_ITEM_UPDATED", detailsJson: { itemId, fields: Object.keys(input) } } });
    return Response.json(item);
  } catch (error) { return error instanceof Response ? error : errorResponse(error); }
}
