export type ReportTask = {
  id?: string; title?: string; status: string; priority: string;
  createdAt?: Date | string; updatedAt?: Date | string; startedAt?: Date | string | null;
  completedAt?: Date | string | null; dueAt: Date | string | null; assigneeUserId: string | null;
  estimatedMinutes?: number | null; remainingMinutes?: number | null; actualMinutes?: number | null;
  blockedAt?: Date | string | null; blockedReason?: string | null; blockerTaskId?: string | null;
  updatedProductsCount?: number | null; newProductsCount?: number | null;
  updatedImagesCount?: number | null; newImagesCount?: number | null;
};
export type ReportMember = {
  id?: string; weeklyCapacityMinutes?: number;
  availability?: { date: Date | string; availableMinutes: number }[];
  user: { id: string; name: string | null; email: string };
};

export type ManagerActionRisk = "overdue" | "blocked" | "unassigned" | "urgent" | "unestimated" | "overloaded";

const DAY = 86_400_000;
const WEEK = 7 * DAY;
export const minutesToHours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;
export const taskRemainingMinutes = (task: ReportTask) => task.status === "DONE" || task.status === "NO_ACTION_NEEDED" ? 0 : task.remainingMinutes ?? task.estimatedMinutes ?? 0;
function monday(value: Date) { const day = value.getUTCDay(); const result = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())); result.setUTCDate(result.getUTCDate() - ((day + 6) % 7)); return result; }
function weekLabel(value: Date) { return value.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" }); }

function summarizeProductAndImageCounts(tasks: ReportTask[]) {
  const values = tasks.reduce((totals, task) => {
    totals.updatedProducts += task.updatedProductsCount ?? 0; totals.newProducts += task.newProductsCount ?? 0;
    totals.updatedImages += task.updatedImagesCount ?? 0; totals.newImages += task.newImagesCount ?? 0;
    if ([task.updatedProductsCount, task.newProductsCount, task.updatedImagesCount, task.newImagesCount].some((value) => value !== null && value !== undefined)) totals.reportingTasks += 1;
    return totals;
  }, { updatedProducts: 0, newProducts: 0, updatedImages: 0, newImages: 0, reportingTasks: 0 });
  const totalProducts = values.updatedProducts + values.newProducts; const totalImages = values.updatedImages + values.newImages;
  return { ...values, totalProducts, totalImages, totalOutput: totalProducts + totalImages };
}

export function buildManagerActionCenter(tasks: ReportTask[], workload: Array<{ user: { id: string }; utilization: number }>, now = new Date(), overloadThreshold = 100) {
  const activeTasks = tasks.filter((task) => task.status !== "DONE" && task.status !== "NO_ACTION_NEEDED");
  const ids = (predicate: (task: ReportTask) => boolean) => activeTasks.filter(predicate).map((task) => task.id).filter((id): id is string => Boolean(id));
  const overloadedMemberIds = workload.filter((member) => member.utilization > overloadThreshold).map((member) => member.user.id);
  const taskIds: Record<Exclude<ManagerActionRisk, "overloaded">, string[]> = {
    overdue: ids((task) => Boolean(task.dueAt && new Date(task.dueAt) < now)),
    blocked: ids((task) => Boolean(task.blockedAt || task.blockerTaskId)),
    unassigned: ids((task) => !task.assigneeUserId),
    urgent: ids((task) => task.priority === "URGENT"),
    unestimated: ids((task) => !task.estimatedMinutes),
  };
  const taskRiskIds = new Set(Object.values(taskIds).flat());
  return {
    total: taskRiskIds.size + overloadedMemberIds.length,
    counts: {
      overdue: taskIds.overdue.length,
      blocked: taskIds.blocked.length,
      unassigned: taskIds.unassigned.length,
      urgent: taskIds.urgent.length,
      unestimated: taskIds.unestimated.length,
      overloaded: overloadedMemberIds.length,
    },
    taskIds,
    overloadedMemberIds,
  };
}

/**
 * Board pages only need the manager risks, not the full eight-week report.
 * Keep this path deliberately small so opening the board does not calculate
 * charts, output totals, and every workload week just to render six counters.
 */
export function buildWorkspaceActionCenter(tasks: ReportTask[], members: ReportMember[], now = new Date(), overloadThreshold = 100) {
  const workload = members.map((member) => {
    const activeTasks = tasks.filter((task) => task.assigneeUserId === member.user.id && task.status !== "DONE" && task.status !== "NO_ACTION_NEEDED");
    const remainingMinutes = activeTasks.reduce((sum, task) => sum + taskRemainingMinutes(task), 0);
    const capacityMinutes = member.weeklyCapacityMinutes ?? 1800;
    return { user: member.user, utilization: capacityMinutes ? Math.round((remainingMinutes / capacityMinutes) * 100) : remainingMinutes ? 999 : 0 };
  });
  return buildManagerActionCenter(tasks, workload, now, overloadThreshold);
}

export function reportRangeStart(range: string, now = new Date()) { return range === "all" ? undefined : new Date(now.getTime() - Number(range) * DAY); }
export function parseCompletionDateRange(from?: string | null, to?: string | null) {
  const parseDate = (value?: string | null) => { if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value ? null : undefined; const date = new Date(`${value}T00:00:00.000Z`); return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date; };
  const start = parseDate(from); const selectedEnd = parseDate(to);
  if (start === null || selectedEnd === null) return { error: "Enter valid completion dates." } as const;
  const end = selectedEnd ? new Date(selectedEnd.getTime() + DAY) : undefined;
  if (start && end && start >= end) return { error: "Start date must be on or before end date." } as const;
  return { start, end } as const;
}

export function taskRiskReasons(task: ReportTask, now = new Date(), settings = { dueSoonDays: 2, stalledAfterDays: 5 }) {
  if (task.status === "DONE" || task.status === "NO_ACTION_NEEDED") return [];
  const reasons: string[] = [];
  if (task.blockedAt || task.blockerTaskId) reasons.push(task.blockedReason ? `Blocked: ${task.blockedReason}` : "Blocked");
  if (!task.assigneeUserId) reasons.push("Unassigned");
  if (!task.estimatedMinutes) reasons.push("No effort estimate");
  if (task.dueAt) { const due = new Date(task.dueAt); if (due < now) reasons.push("Overdue"); else if (due.getTime() <= now.getTime() + settings.dueSoonDays * DAY) reasons.push("Due soon"); }
  if (task.updatedAt && now.getTime() - new Date(task.updatedAt).getTime() >= settings.stalledAfterDays * DAY) reasons.push(`No update for ${settings.stalledAfterDays}+ days`);
  return reasons;
}

export function buildWorkspaceReport(tasks: ReportTask[], members: ReportMember[], now = new Date(), outputTasks = tasks, settings = { overloadThreshold: 100, dueSoonDays: 2, stalledAfterDays: 5 }) {
  const activeTasks = tasks.filter((task) => task.status !== "DONE" && task.status !== "NO_ACTION_NEEDED");
  const actionableTasks = tasks.filter((task) => task.status !== "NO_ACTION_NEEDED");
  const overdueTasks = activeTasks.filter((task) => task.dueAt && new Date(task.dueAt) < now);
  const dueSoonTasks = activeTasks.filter((task) => task.dueAt && new Date(task.dueAt) >= now && new Date(task.dueAt).getTime() <= now.getTime() + 7 * DAY);
  const statuses = ["TODO", "IN_PROGRESS", "DONE", "NO_ACTION_NEEDED"].map((status) => ({ status, count: tasks.filter((task) => task.status === status).length }));
  const priorities = ["URGENT", "HIGH", "MEDIUM", "LOW"].map((priority) => ({ priority, count: tasks.filter((task) => task.priority === priority).length }));
  const currentWeek = monday(now); const weeks = Array.from({ length: 4 }, (_, index) => { const start = new Date(currentWeek.getTime() + index * WEEK); return { start, end: new Date(start.getTime() + WEEK), label: index === 0 ? "This week" : weekLabel(start) }; });
  const workload = members.map((member) => {
    const { user } = member; const assigned = tasks.filter((task) => task.assigneeUserId === user.id); const active = assigned.filter((task) => task.status !== "DONE" && task.status !== "NO_ACTION_NEEDED");
    const capacityMinutes = member.weeklyCapacityMinutes ?? 1800; const remainingMinutes = active.reduce((sum, task) => sum + taskRemainingMinutes(task), 0);
    const weekly = weeks.map((week, index) => {
      const availabilityExceptions = member.availability?.filter((item) => { const date = new Date(item.date); return date >= week.start && date < week.end; }) ?? [];
      const capacity = Math.max(0, Math.round(availabilityExceptions.reduce((total, item) => { const day = new Date(item.date).getUTCDay(); const normalDayMinutes = day >= 1 && day <= 5 ? capacityMinutes / 5 : 0; return total - normalDayMinutes + item.availableMinutes; }, capacityMinutes)));
      const effort = active.filter((task) => { if (!task.dueAt) return index === 0; const due = new Date(task.dueAt); return due < week.end && (index === 0 || due >= week.start); }).reduce((sum, task) => sum + taskRemainingMinutes(task), 0);
      return { ...week, effortMinutes: effort, capacityMinutes: capacity, utilization: capacity ? Math.round((effort / capacity) * 100) : effort ? 999 : 0 };
    });
    const utilization = capacityMinutes ? Math.round((remainingMinutes / capacityMinutes) * 100) : remainingMinutes ? 999 : 0;
    return { user, memberId: member.id, total: assigned.length, open: active.length, completed: assigned.length - active.length, overdue: active.filter((task) => task.dueAt && new Date(task.dueAt) < now).length, blocked: active.filter((task) => task.blockedAt || task.blockerTaskId).length, unestimated: active.filter((task) => !task.estimatedMinutes).length, estimatedMinutes: active.reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0), remainingMinutes, capacityMinutes, utilization, weekly };
  }).sort((a, b) => b.utilization - a.utilization || a.user.email.localeCompare(b.user.email));
  const completed = statuses.find((item) => item.status === "DONE")?.count || 0;
  const productAndImageCounts = summarizeProductAndImageCounts(outputTasks);
  const outputByMember = members.map(({ user }) => ({ user, ...summarizeProductAndImageCounts(outputTasks.filter((task) => task.assigneeUserId === user.id)) }));
  const unassignedOutput = summarizeProductAndImageCounts(outputTasks.filter((task) => !task.assigneeUserId)); if (unassignedOutput.reportingTasks) outputByMember.push({ user: { id: "__unassigned__", name: "Unassigned", email: "" }, ...unassignedOutput });
  outputByMember.sort((a, b) => b.totalOutput - a.totalOutput || b.reportingTasks - a.reportingTasks || (a.user.name || a.user.email).localeCompare(b.user.name || b.user.email));
  const risks = activeTasks.map((task) => ({ task, reasons: taskRiskReasons(task, now, settings) })).filter((item) => item.reasons.length).sort((a, b) => b.reasons.length - a.reasons.length || (a.task.dueAt ? new Date(a.task.dueAt).getTime() : Infinity) - (b.task.dueAt ? new Date(b.task.dueAt).getTime() : Infinity));
  const flowWeeks = Array.from({ length: 8 }, (_, index) => { const start = new Date(currentWeek.getTime() - (7 - index) * WEEK); const end = new Date(start.getTime() + WEEK); const completedTasks = tasks.filter((task) => task.completedAt && new Date(task.completedAt) >= start && new Date(task.completedAt) < end); const cycleValues = completedTasks.filter((task) => task.startedAt).map((task) => Math.max(0, (new Date(task.completedAt!).getTime() - new Date(task.startedAt!).getTime()) / DAY)); return { label: weekLabel(start), completed: completedTasks.length, onTime: completedTasks.filter((task) => !task.dueAt || new Date(task.completedAt!) <= new Date(task.dueAt)).length, averageCycleDays: cycleValues.length ? Math.round((cycleValues.reduce((a, b) => a + b, 0) / cycleValues.length) * 10) / 10 : 0 }; });
  const estimatedCompleted = tasks.filter((task) => task.status === "DONE" && task.estimatedMinutes && task.actualMinutes != null);
  const estimateAccuracy = estimatedCompleted.length ? Math.round(estimatedCompleted.reduce((sum, task) => sum + Math.min(task.estimatedMinutes!, task.actualMinutes!) / Math.max(task.estimatedMinutes!, task.actualMinutes!) * 100, 0) / estimatedCompleted.length) : 0;
  const actionCenter = buildManagerActionCenter(tasks, workload, now, settings.overloadThreshold);
  return { total: tasks.length, completed, noActionNeeded: tasks.length - actionableTasks.length, completionRate: actionableTasks.length ? Math.round((completed / actionableTasks.length) * 100) : 0, overdue: overdueTasks.length, dueSoon: dueSoonTasks.length, unassigned: activeTasks.filter((task) => !task.assigneeUserId).length, blocked: activeTasks.filter((task) => task.blockedAt || task.blockerTaskId).length, unestimated: activeTasks.filter((task) => !task.estimatedMinutes).length, overloaded: workload.filter((item) => item.utilization > settings.overloadThreshold).length, statuses, priorities, workload, weeks: weeks.map(({ label, start }) => ({ label, start })), risks, flowWeeks, estimateAccuracy, productAndImageCounts, outputByMember, actionCenter };
}

export function buildWeeklyManagementSummary(tasks: ReportTask[], members: ReportMember[], now = new Date(), settings = { overloadThreshold: 100, dueSoonDays: 2, stalledAfterDays: 5 }, existingReport?: ReturnType<typeof buildWorkspaceReport>) {
  const report = existingReport ?? buildWorkspaceReport(tasks, members, now, tasks, settings);
  const weekStart = monday(now);
  const weekEnd = new Date(weekStart.getTime() + WEEK);
  const inCurrentWeek = (value?: Date | string | null) => Boolean(value && new Date(value) >= weekStart && new Date(value) < weekEnd);
  const completedThisWeek = tasks.filter((task) => task.status === "DONE" && inCurrentWeek(task.completedAt));
  const createdThisWeek = tasks.filter((task) => inCurrentWeek(task.createdAt));
  const cycleValues = completedThisWeek.filter((task) => task.startedAt).map((task) => Math.max(0, (new Date(task.completedAt!).getTime() - new Date(task.startedAt!).getTime()) / DAY));
  const averageCycleDays = cycleValues.length ? Math.round((cycleValues.reduce((sum, value) => sum + value, 0) / cycleValues.length) * 10) / 10 : null;
  const keyRisks = [
    report.overdue ? `${report.overdue} overdue task${report.overdue === 1 ? "" : "s"}` : "",
    report.blocked ? `${report.blocked} blocked task${report.blocked === 1 ? "" : "s"}` : "",
    report.overloaded ? `${report.overloaded} team member${report.overloaded === 1 ? "" : "s"} above capacity` : "",
    report.unassigned ? `${report.unassigned} unassigned task${report.unassigned === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  const managementActions = [
    report.overdue ? `Review ${report.overdue} overdue task${report.overdue === 1 ? "" : "s"}.` : "",
    report.blocked ? `Resolve ${report.blocked} blocked task${report.blocked === 1 ? "" : "s"}.` : "",
    report.overloaded ? `Rebalance ${report.overloaded} overloaded team member${report.overloaded === 1 ? "" : "s"}.` : "",
    report.unassigned ? `Assign owners to ${report.unassigned} unassigned task${report.unassigned === 1 ? "" : "s"}.` : "",
    report.unestimated ? `Add estimates to ${report.unestimated} open task${report.unestimated === 1 ? "" : "s"}.` : "",
  ].filter(Boolean);
  return { completedThisWeek: completedThisWeek.length, createdThisWeek: createdThisWeek.length, openTasks: tasks.filter((task) => task.status !== "DONE" && task.status !== "NO_ACTION_NEEDED").length, overdue: report.overdue, blocked: report.blocked, urgentOpen: tasks.filter((task) => task.status !== "DONE" && task.status !== "NO_ACTION_NEEDED" && task.priority === "URGENT").length, unassigned: report.unassigned, overloaded: report.overloaded, overloadThreshold: settings.overloadThreshold, averageCycleDays, keyRisks, managementActions, workload: report.workload, generatedAt: now.toISOString() };
}

export function weeklySummaryToText(summary: ReturnType<typeof buildWeeklyManagementSummary>) {
  const lines = [
    "TaskFlow weekly management summary",
    "",
    `Completed this week: ${summary.completedThisWeek}`,
    `Created this week: ${summary.createdThisWeek}`,
    `Open tasks: ${summary.openTasks}`,
    `Overdue tasks: ${summary.overdue}`,
    `Blocked tasks: ${summary.blocked}`,
    `Urgent open tasks: ${summary.urgentOpen}`,
    `Unassigned tasks: ${summary.unassigned}`,
    `Overloaded team members: ${summary.overloaded}`,
    `Average cycle time: ${summary.averageCycleDays === null ? "Not available" : `${summary.averageCycleDays} days`}`,
    "",
    "Key risks",
    ...(summary.keyRisks.length ? summary.keyRisks.map((risk) => `- ${risk}`) : ["- No current management risks."]),
    "",
    "Management actions",
    ...(summary.managementActions.length ? summary.managementActions.map((action, index) => `${index + 1}. ${action}`) : ["- No immediate management action required."]),
  ];
  return lines.join("\n");
}

export function reportToCsv(report: ReturnType<typeof buildWorkspaceReport>) {
  const counts = report.productAndImageCounts;
  const rows: (string | number)[][] = [
    ["Manager summary", "Count"], ["Overloaded members", report.overloaded], ["At-risk tasks", report.risks.length], ["Blocked tasks", report.blocked], ["Unestimated tasks", report.unestimated], [],
    ["Product & image activity", "Count"], ["Updated products", counts.updatedProducts], ["New products", counts.newProducts], ["Total products", counts.totalProducts], ["Updated images", counts.updatedImages], ["New images", counts.newImages], ["Total images", counts.totalImages], ["Tasks reporting counts", counts.reportingTasks], [],
    ["Output by team member", "Tasks reporting", "Updated products", "New products", "Updated images", "New images", "Total output"], ...report.outputByMember.map((item) => [item.user.name || item.user.email, item.reportingTasks, item.updatedProducts, item.newProducts, item.updatedImages, item.newImages, item.totalOutput]), [],
    ["Team member", "Capacity hours", "Remaining hours", "Utilization", "Open", "Blocked", "Overdue"], ...report.workload.map((item) => [item.user.name || item.user.email, minutesToHours(item.capacityMinutes), minutesToHours(item.remainingMinutes), `${item.utilization}%`, item.open, item.blocked, item.overdue]),
  ];
  const csvCell = (value: string | number) => {
    const text = String(value);
    // Prevent spreadsheet applications from treating user-controlled names or
    // emails that start with a formula character as executable formulas.
    const safeText = typeof value === "string" && /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
  };
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
