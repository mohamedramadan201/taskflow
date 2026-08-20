export function statusUpdateFields(task: { status: string; startedAt: Date | null; completedAt: Date | null }, status: string, now = new Date()) {
  return {
    startedAt: status === "TODO" || status === "NO_ACTION_NEEDED" ? null : task.startedAt ?? now,
    completedAt: status === "DONE" ? task.completedAt ?? now : null,
    remainingMinutes: status === "DONE" ? 0 : undefined,
  };
}
