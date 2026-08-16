export type Recurrence = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";

export function nextRecurringDate(value: Date | null, recurrence: Recurrence, interval: number, now = new Date()) {
  const next = value ? new Date(value) : new Date(now);
  if (recurrence === "DAILY") next.setDate(next.getDate() + interval);
  if (recurrence === "WEEKLY") next.setDate(next.getDate() + (7 * interval));
  if (recurrence === "MONTHLY") {
    const originalDay = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + interval);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(originalDay, lastDay));
  }
  return next;
}
