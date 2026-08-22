export type ReminderFilter = "all" | "today" | "upcoming" | "overdue" | "recurring" | "assignedToMe" | "createdByMe" | "sent" | "done" | "cancelled" | "error";

export function normalizeReminderEmails(value: string | string[]) {
  const values = Array.isArray(value) ? value : value.split(/[;,\s]+/);
  const unique = new Set<string>();
  for (const item of values) {
    const email = item.trim().toLowerCase();
    if (email) unique.add(email);
  }
  return [...unique];
}

export function normalizeReminderTags(value: string | string[]) {
  const values = Array.isArray(value) ? value : value.split(/[,;\n]+/);
  const unique = new Map<string, string>();
  for (const item of values) {
    const tag = item.trim();
    if (tag && !unique.has(tag.toLowerCase())) unique.set(tag.toLowerCase(), tag);
  }
  return [...unique.values()];
}

export function getNextReminderDate(from: Date, repeatType: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY", repeatInterval: number, now = new Date()) {
  if (repeatType === "NONE") return null;
  const next = new Date(from);
  const interval = Math.max(1, Math.trunc(repeatInterval || 1));
  const advance = () => {
    if (repeatType === "DAILY") next.setDate(next.getDate() + interval);
    if (repeatType === "WEEKLY") next.setDate(next.getDate() + interval * 7);
    if (repeatType === "MONTHLY") next.setMonth(next.getMonth() + interval);
  };
  advance();
  let guard = 0;
  while (next <= now && guard < 100) { advance(); guard += 1; }
  return next;
}

export function matchesReminderFilter(reminder: { status: string; reminderAt: Date; repeatType: string; assignedEmails: string[] }, filter: ReminderFilter, userEmail: string, now = new Date()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  if (filter === "today") return reminder.status === "PENDING" && reminder.reminderAt >= start && reminder.reminderAt < end;
  if (filter === "upcoming") return reminder.status === "PENDING" && reminder.reminderAt >= now;
  if (filter === "overdue") return reminder.status === "PENDING" && reminder.reminderAt < now;
  if (filter === "recurring") return reminder.repeatType !== "NONE";
  if (filter === "assignedToMe") return reminder.assignedEmails.includes(userEmail.toLowerCase());
  if (filter === "sent") return reminder.status === "SENT";
  if (filter === "done") return reminder.status === "DONE";
  if (filter === "cancelled") return reminder.status === "CANCELLED";
  if (filter === "error") return reminder.status === "ERROR";
  return true;
}
