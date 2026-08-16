import { z } from "zod";
import { customRolePermissions, permissions, type Permission } from "@/lib/permissions";
import { assertPermission, HttpError, errorResponse, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { parseJson } from "@/lib/validation";

const roleInput = z.object({
  name: z.string().trim().min(2).max(50),
  description: z.string().trim().max(200).optional().nullable(),
  permissions: z.array(z.enum(permissions)).max(customRolePermissions.length),
});
const allowed = new Set<Permission>(customRolePermissions);

export async function GET(_: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    const access = await requireMembership(workspaceId);
    assertPermission(access.subject, "MEMBER_VIEW", "Role access denied");
    return Response.json(await prisma.workspaceRoleDefinition.findMany({ where: { workspaceId }, select: { id: true, name: true, description: true, permissions: true, _count: { select: { members: true } } }, orderBy: { name: "asc" } }));
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    const access = await requireMembership(workspaceId);
    assertPermission(access.subject, "CUSTOM_ROLE_MANAGE", "Custom role management denied");
    const input = await parseJson(request, roleInput);
    if (input.permissions.some((permission) => !allowed.has(permission))) throw new HttpError(403, "Custom roles cannot receive owner-only permissions");
    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.workspaceRoleDefinition.create({ data: { workspaceId, name: input.name, description: input.description || null, permissions: [...new Set(input.permissions)] } });
      await tx.activityEvent.create({ data: { workspaceId, actorUserId: access.user.id, type: "CUSTOM_ROLE_CREATED", detailsJson: { roleId: created.id, name: created.name, permissions: input.permissions } } });
      return created;
    });
    return Response.json(role, { status: 201 });
  } catch (error) { return error instanceof Response ? error : errorResponse(error); }
}
