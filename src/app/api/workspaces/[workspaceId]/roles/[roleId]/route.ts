import { z } from "zod";
import { customRolePermissions, permissions, type Permission } from "@/lib/permissions";
import { assertPermission, HttpError, errorResponse, requireWorkspaceOwner } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { parseJson } from "@/lib/validation";

const patchSchema = z.object({ name: z.string().trim().min(2).max(50).optional(), description: z.string().trim().max(200).nullable().optional(), permissions: z.array(z.enum(permissions)).max(customRolePermissions.length).optional() }).refine((value) => Object.keys(value).length > 0, "A role change is required");
const allowed = new Set<Permission>(customRolePermissions);

async function context(workspaceId: string, roleId: string) {
  const access = await requireWorkspaceOwner(workspaceId);
  assertPermission(access.subject, "CUSTOM_ROLE_MANAGE", "Custom role management denied");
  const customRole = await prisma.workspaceRoleDefinition.findFirst({ where: { id: roleId, workspaceId } });
  if (!customRole) throw new HttpError(404, "Custom role not found");
  return { access, customRole };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ workspaceId: string; roleId: string }> }) {
  try {
    const { workspaceId, roleId } = await params;
    const { access, customRole } = await context(workspaceId, roleId);
    const input = await parseJson(request, patchSchema);
    if (input.permissions?.some((permission) => !allowed.has(permission))) throw new HttpError(403, "Custom roles cannot receive owner-only permissions");
    const updated = await prisma.$transaction(async (tx) => {
      const role = await tx.workspaceRoleDefinition.update({ where: { id: customRole.id }, data: { ...input, ...(input.permissions ? { permissions: [...new Set(input.permissions)] } : {}) } });
      await tx.activityEvent.create({ data: { workspaceId, actorUserId: access.user.id, type: "CUSTOM_ROLE_UPDATED", detailsJson: { roleId, fields: Object.keys(input) } } });
      return role;
    });
    return Response.json(updated);
  } catch (error) { return error instanceof Response ? error : errorResponse(error); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ workspaceId: string; roleId: string }> }) {
  try {
    const { workspaceId, roleId } = await params;
    const { access, customRole } = await context(workspaceId, roleId);
    await prisma.$transaction([
      prisma.workspaceRoleDefinition.delete({ where: { id: customRole.id } }),
      prisma.activityEvent.create({ data: { workspaceId, actorUserId: access.user.id, type: "CUSTOM_ROLE_DELETED", detailsJson: { roleId, name: customRole.name } } }),
    ]);
    return new Response(null, { status: 204 });
  } catch (error) { return errorResponse(error); }
}
