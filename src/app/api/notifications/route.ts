import { requireUser, errorResponse } from "@/lib/server/authorization";
import { prisma, withDatabaseRetry } from "@/lib/server/prisma";
export async function GET(request: Request) { try {
  const user = await requireUser(); const url = new URL(request.url); const take = Math.min(Math.max(Number(url.searchParams.get("limit")) || 30, 1), 100);
  const notifications = await withDatabaseRetry(() => prisma.notification.findMany({ where: { userId: user.id, ...(url.searchParams.get("workspaceId") ? { workspaceId: url.searchParams.get("workspaceId")! } : {}) }, include: { task: { select: { id: true, title: true } }, workspace: { select: { name: true, slug: true } } }, orderBy: { createdAt: "desc" }, take }));
  return Response.json(notifications);
} catch (e) { return errorResponse(e); } }
