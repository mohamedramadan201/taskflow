import { z } from "zod";
import { canAssignWorkspaceRole } from "@/lib/permissions";
import { assertPermission, HttpError, requireMembership, errorResponse } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { parseJson, roleSchema } from "@/lib/validation";

async function context(workspaceId: string, memberUserId: string) {
  const access = await requireMembership(workspaceId);
  assertPermission(access.subject, "MEMBER_MANAGE", "Member management denied");
  const target = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: memberUserId } } });
  if (!target) throw new HttpError(404, "Member not found");
  if (access.role === "ADMIN" && (target.role === "OWNER" || target.role === "ADMIN")) throw new HttpError(403, "Admins cannot manage owners or admins");
  return { ...access, target };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ workspaceId: string; memberUserId: string }> }) {
  try {
    const { workspaceId, memberUserId } = await params;
    const { user, role, target, subject } = await context(workspaceId, memberUserId);
    const input = await parseJson(request, z.object({ role: roleSchema.optional(), suspended: z.boolean().optional(), customRoleId: z.string().min(1).nullable().optional(), teamGroupId: z.string().min(1).nullable().optional(), weeklyCapacityMinutes: z.number().int().min(0).max(10080).optional() }).refine((value) => value.role !== undefined || value.suspended !== undefined || value.customRoleId !== undefined || value.teamGroupId !== undefined || value.weeklyCapacityMinutes !== undefined, "A role, custom role, team group, capacity, or suspension change is required"));
    if (user.id === memberUserId && (input.role !== undefined || input.suspended !== undefined || input.customRoleId !== undefined)) throw new HttpError(409, "You cannot change your own access");
    if (input.role && !canAssignWorkspaceRole(role, input.role)) throw new HttpError(403, "Cannot assign this role");
    if (input.customRoleId !== undefined) {
      assertPermission(subject, "CUSTOM_ROLE_MANAGE", "Custom role assignment denied");
      if (target.role === "OWNER") throw new HttpError(409, "Owners cannot be restricted by a custom role");
      if (input.customRoleId && !(await prisma.workspaceRoleDefinition.findFirst({ where: { id: input.customRoleId, workspaceId }, select: { id: true } }))) throw new HttpError(404, "Custom role not found");
    }
    if (input.teamGroupId && !(await prisma.teamGroup.findFirst({ where: { id: input.teamGroupId, workspaceId }, select: { id: true } }))) throw new HttpError(404, "Team group not found");
    const removingOwnerAccess = target.role === "OWNER" && ((input.role && input.role !== "OWNER") || input.suspended === true);
    if (removingOwnerAccess && await prisma.workspaceMember.count({ where: { workspaceId, role: "OWNER", suspendedAt: null } }) <= 1) throw new HttpError(409, "A workspace must keep at least one active owner");

    const member = await prisma.$transaction(async (tx) => {
      const updated = await tx.workspaceMember.update({
        where: { id: target.id },
        data: {
          ...(input.role ? { role: input.role } : {}),
          ...(input.customRoleId !== undefined ? { customRoleId: input.customRoleId } : input.role ? { customRoleId: null } : {}),
          ...(input.teamGroupId !== undefined ? { teamGroupId: input.teamGroupId } : {}),
          ...(input.suspended !== undefined ? { suspendedAt: input.suspended ? new Date() : null, suspendedByUserId: input.suspended ? user.id : null } : {}),
          ...(input.weeklyCapacityMinutes !== undefined ? { weeklyCapacityMinutes: input.weeklyCapacityMinutes } : {}),
        },
      });
      if (input.role && input.role !== target.role) await tx.activityEvent.create({ data: { workspaceId, actorUserId: user.id, type: "MEMBER_ROLE_CHANGED", detailsJson: { targetUserId: memberUserId, from: target.role, to: input.role } } });
      if (input.suspended !== undefined && Boolean(target.suspendedAt) !== input.suspended) await tx.activityEvent.create({ data: { workspaceId, actorUserId: user.id, type: input.suspended ? "MEMBER_SUSPENDED" : "MEMBER_REACTIVATED", detailsJson: { targetUserId: memberUserId } } });
      if (input.customRoleId !== undefined && input.customRoleId !== target.customRoleId) await tx.activityEvent.create({ data: { workspaceId, actorUserId: user.id, type: "CUSTOM_ROLE_ASSIGNED", detailsJson: { targetUserId: memberUserId, customRoleId: input.customRoleId } } });
      if (input.teamGroupId !== undefined && input.teamGroupId !== target.teamGroupId) await tx.activityEvent.create({ data: { workspaceId, actorUserId: user.id, type: "MEMBER_TEAM_GROUP_CHANGED", detailsJson: { targetUserId: memberUserId, fromTeamGroupId: target.teamGroupId, toTeamGroupId: input.teamGroupId } } });
      if (input.weeklyCapacityMinutes !== undefined && input.weeklyCapacityMinutes !== target.weeklyCapacityMinutes) await tx.activityEvent.create({ data: { workspaceId, actorUserId: user.id, type: "MEMBER_CAPACITY_CHANGED", detailsJson: { targetUserId: memberUserId, fromMinutes: target.weeklyCapacityMinutes, toMinutes: input.weeklyCapacityMinutes } } });
      return updated;
    });
    return Response.json(member);
  } catch (error) { return error instanceof Response ? error : errorResponse(error); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ workspaceId: string; memberUserId: string }> }) {
  try {
    const { workspaceId, memberUserId } = await params;
    const { user, target } = await context(workspaceId, memberUserId);
    if (user.id === memberUserId) throw new HttpError(409, "You cannot remove your own membership");
    if (target.role === "OWNER" && await prisma.workspaceMember.count({ where: { workspaceId, role: "OWNER", suspendedAt: null } }) <= 1) throw new HttpError(409, "The last active owner cannot be removed");
    await prisma.$transaction([
      prisma.workspaceMember.delete({ where: { id: target.id } }),
      prisma.activityEvent.create({ data: { workspaceId, actorUserId: user.id, type: "MEMBER_REMOVED", detailsJson: { targetUserId: memberUserId } } }),
    ]);
    return new Response(null, { status: 204 });
  } catch (error) { return errorResponse(error); }
}
