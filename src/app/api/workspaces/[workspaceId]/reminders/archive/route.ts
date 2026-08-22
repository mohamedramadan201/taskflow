import { assertPermission, errorResponse, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { parseJson } from "@/lib/validation";
import { z } from "zod";

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    const access = await requireMembership(workspaceId);
    assertPermission(access.subject, "WORKSPACE_MANAGE", "Reminder archive requires workspace management access");
    const input = await parseJson(request, z.object({ days: z.number().int().min(1).max(3650).optional() }));
    const settings = await prisma.workspaceReminderSettings.findUnique({ where: { workspaceId } });
    const days = input.days || settings?.archiveAfterDays || 90;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await prisma.workspaceReminder.updateMany({ where: { workspaceId, archivedAt: null, status: { in: ["SENT", "DONE", "CANCELLED"] }, lastUpdatedAt: { lt: cutoff } }, data: { archivedAt: new Date() } });
    return Response.json({ success: true, archived: result.count });
  } catch (error) { return errorResponse(error); }
}
