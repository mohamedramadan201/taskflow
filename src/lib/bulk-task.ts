import { canAssignTaskTo, canModifyTask, type AuthorizationSubject } from "./permissions.ts";

export type BulkAction = "ASSIGN" | "STATUS" | "PRIORITY" | "DUE_DATE" | "ADD_LABEL" | "REMOVE_LABEL";
export type BulkTaskOwnership = { id: string; workspaceId: string; createdByUserId: string; assigneeUserId: string | null };

export function bulkTaskFailure(subject: AuthorizationSubject, actorUserId: string, task: BulkTaskOwnership, action: BulkAction, assigneeUserId?: string | null) {
  if (!canModifyTask(subject, actorUserId, task)) return "Task modification denied";
  if (action === "ASSIGN" && assigneeUserId !== task.assigneeUserId && !canAssignTaskTo(subject, actorUserId, assigneeUserId)) return "Task assignment denied";
  return null;
}

export function allTaskIdsBelongToWorkspace(taskIds: string[], tasks: Array<{ id: string; workspaceId: string }>, workspaceId: string) {
  const found = new Set(tasks.filter((task) => task.workspaceId === workspaceId).map((task) => task.id));
  return [...new Set(taskIds)].every((taskId) => found.has(taskId)) && found.size === new Set(taskIds).size;
}
