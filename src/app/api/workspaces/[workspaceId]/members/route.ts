import { z } from "zod";
import { canAssignWorkspaceRole } from "@/lib/permissions";
import { assertPermission, HttpError, requireMembership, errorResponse } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { parseJson, roleSchema } from "@/lib/validation";
export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) { try {
  const { workspaceId } = await params; const { user, role, subject } = await requireMembership(workspaceId);
  assertPermission(subject, "MEMBER_MANAGE", "Member management denied");
  const input = await parseJson(request, z.object({ email: z.string().email().transform((v) => v.trim().toLowerCase()), role: roleSchema }));
  if (!canAssignWorkspaceRole(role, input.role)) throw new HttpError(403, "Cannot assign this role");
  const target = await prisma.user.findUnique({ where: { email: input.email } }); if (!target) throw new HttpError(404, "User must already have an account");
  const member = await prisma.$transaction(async (tx) => { const created = await tx.workspaceMember.create({ data: { workspaceId, userId: target.id, role: input.role } }); await tx.activityEvent.create({ data: { workspaceId, actorUserId: user.id, type: "MEMBER_ADDED", detailsJson: { targetUserId: target.id, role: input.role } } }); return created; });
  return Response.json(member, { status: 201 });
} catch (e) { return e instanceof Response ? e : errorResponse(e); } }
