// Shared types and small pure helpers used by both BoardClient and the extracted
// TaskDrawer. Kept in one place so the two components describe the same task shape.

export type Member = { role: string; teamGroupId: string | null; teamGroup: { id: string; name: string } | null; user: { id: string; name: string | null; email: string } };
export type Label = { id: string; name: string; color: string };
export type TaskCountKey = "updatedProductsCount" | "newProductsCount" | "updatedImagesCount" | "newImagesCount";
export type Task = { id: string; title: string; description: string | null; status: string; priority: string; dueAt: string | Date | null; startedAt: string | Date | null; completedAt: string | Date | null; createdAt?: string | Date; updatedAt?: string | Date; estimatedMinutes: number | null; remainingMinutes: number | null; actualMinutes: number | null; blockedAt: string | Date | null; blockedReason: string | null; blockerTaskId: string | null; recurrence: string; recurrenceInterval: number; updatedProductsCount: number | null; newProductsCount: number | null; updatedImagesCount: number | null; newImagesCount: number | null; createdByUserId: string; assigneeUserId: string | null; followUpWith: string | null; assignee: { id: string; name: string | null; email: string } | null; labels: Label[] };
export type ChecklistItem = { id: string; title: string; completed: boolean; position: number };
export type TaskDetail = Task & { blockerTask?: { id: string; title: string; status: string } | null; sourceEmails?: { id: string; subject: string; senderAddress: string; receivedAt: string; connector: { mailboxAddress: string } }[]; createdBy: { id: string; name: string | null; email: string }; checklistItems: ChecklistItem[]; comments: { id: string; body: string; createdAt: string; author: { id: string; name: string | null; email: string } }[]; activities: { id: string; type: string; createdAt: string; actor: { name: string | null; email: string } }[] };

export const taskStatuses = [["TODO", "To do"], ["IN_PROGRESS", "In progress"], ["DONE", "Completed"], ["NO_ACTION_NEEDED", "No Action Needed"]] as const;
export const priority: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };
export const taskCountOptions: ReadonlyArray<{ key: TaskCountKey; label: string }> = [
  { key: "updatedProductsCount", label: "Updated Products Count" },
  { key: "newProductsCount", label: "New Products Count" },
  { key: "updatedImagesCount", label: "Updated Images Count" },
  { key: "newImagesCount", label: "New Images Count" },
];

export function toggleValue(items: string[], value: string) { return items.includes(value) ? items.filter((item) => item !== value) : [...items, value]; }
export function personName(member: Member) { return member.user.name || member.user.email; }
