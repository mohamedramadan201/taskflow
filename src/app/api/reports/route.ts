import { assertPermission, errorResponse, requireWorkspaceBySlug } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { buildWorkspaceReport, parseCompletionDateRange, reportToCsv } from "@/lib/reporting";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("workspace");
    if (!slug) return Response.json({ error: "workspace is required" }, { status: 400 });
    const range = url.searchParams.get("range") || "30";
    const { workspace, subject } = await requireWorkspaceBySlug(slug);
    assertPermission(subject, "REPORT_VIEW", "Report access denied");
    if (url.searchParams.get("format") === "csv") assertPermission(subject, "REPORT_EXPORT", "Report export denied");
    const since = range === "all" ? undefined : new Date(Date.now() - Math.min(Math.max(Number(range) || 30, 1), 365) * 86_400_000);
    const completedFrom = url.searchParams.get("completedFrom");
    const completedTo = url.searchParams.get("completedTo");
    const hasCustomCompletionRange = Boolean(completedFrom || completedTo);
    const completionRange = parseCompletionDateRange(completedFrom, completedTo);
    if ("error" in completionRange) return Response.json({ error: completionRange.error }, { status: 400 });
    const completedAt = { not: null, ...(hasCustomCompletionRange ? { ...(completionRange.start ? { gte: completionRange.start } : {}), ...(completionRange.end ? { lt: completionRange.end } : {}) } : since ? { gte: since } : {}) };
    const taskSelect = { id: true, title: true, status: true, priority: true, createdAt: true, updatedAt: true, startedAt: true, completedAt: true, dueAt: true, assigneeUserId: true, estimatedMinutes: true, remainingMinutes: true, actualMinutes: true, blockedAt: true, blockedReason: true, blockerTaskId: true, updatedProductsCount: true, newProductsCount: true, updatedImagesCount: true, newImagesCount: true } as const;
    const [tasks, outputTasks, members] = await Promise.all([prisma.task.findMany({ where: { workspaceId: workspace.id, ...(since ? { createdAt: { gte: since } } : {}) }, select: taskSelect }), prisma.task.findMany({ where: { workspaceId: workspace.id, completedAt }, select: taskSelect }), prisma.workspaceMember.findMany({ where: { workspaceId: workspace.id }, select: { id: true, weeklyCapacityMinutes: true, availability: { select: { date: true, availableMinutes: true } }, user: { select: { id: true, name: true, email: true } } } })]);
    const report = buildWorkspaceReport(tasks, members, new Date(), outputTasks, { overloadThreshold: workspace.overloadThreshold, dueSoonDays: workspace.dueSoonDays, stalledAfterDays: workspace.stalledAfterDays });
    if (url.searchParams.get("format") === "csv") return new Response(reportToCsv(report), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${slug}-reports.csv"` } });
    return Response.json({ workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug }, range, completionDate: { from: completedFrom, to: completedTo }, ...report });
  } catch (error) { return errorResponse(error); }
}
