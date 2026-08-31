import { canModifyTask } from "@/lib/permissions";
import { errorResponse, HttpError, requireMembership } from "@/lib/server/authorization";
import { assertTaskVisible } from "@/lib/server/record-access";
import { prisma } from "@/lib/server/prisma";
import { parseJson, taskLabelsSchema } from "@/lib/validation";

export async function PUT(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params; const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new HttpError(404, "Task not found");
    const { user, subject } = await requireMembership(task.workspaceId);
    await assertTaskVisible(taskId, task.workspaceId, user.id, user.email);
    if (!canModifyTask(subject, user.id, task)) throw new HttpError(403, "Task modification denied");
    const { labelIds } = await parseJson(request, taskLabelsSchema); const uniqueIds = [...new Set(labelIds)];
    const validCount = await prisma.taskLabel.count({ where: { workspaceId: task.workspaceId, id: { in: uniqueIds } } });
    if (validCount !== uniqueIds.length) throw new HttpError(400, "Every label must belong to this workspace");
    await prisma.$transaction(async (tx) => {
      await tx.taskLabelAssignment.deleteMany({ where: { taskId } });
      if (uniqueIds.length) await tx.taskLabelAssignment.createMany({ data: uniqueIds.map((labelId) => ({ taskId, labelId })) });
      await tx.activityEvent.create({ data: { workspaceId: task.workspaceId, taskId, actorUserId: user.id, type: "TASK_LABELS_UPDATED", detailsJson: { labelIds: uniqueIds } } });
    });
    return Response.json(await prisma.taskLabel.findMany({ where: { assignments: { some: { taskId } } }, orderBy: { name: "asc" } }));
  } catch (error) { return error instanceof Response ? error : errorResponse(error); }
}
