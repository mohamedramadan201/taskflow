import { z } from "zod";
import { assertPermission, errorResponse, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { parseJson } from "@/lib/validation";

const schema = z.object({ overloadThreshold: z.number().int().min(50).max(200), dueSoonDays: z.number().int().min(1).max(30), stalledAfterDays: z.number().int().min(1).max(90) });

export async function PATCH(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params; const { user, subject } = await requireMembership(workspaceId);
    assertPermission(subject, "WORKSPACE_MANAGE", "Workload settings management denied");
    const input = await parseJson(request, schema);
    const workspace = await prisma.$transaction(async (tx) => {
      const updated = await tx.workspace.update({ where: { id: workspaceId }, data: input, select: { overloadThreshold: true, dueSoonDays: true, stalledAfterDays: true } });
      await tx.activityEvent.create({ data: { workspaceId, actorUserId: user.id, type: "WORKLOAD_SETTINGS_CHANGED", detailsJson: input } });
      return updated;
    });
    return Response.json(workspace);
  } catch (error) { return error instanceof Response ? error : errorResponse(error); }
}
