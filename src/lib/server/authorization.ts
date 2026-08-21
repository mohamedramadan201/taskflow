import { auth } from "@/auth";
import { prisma } from "./prisma";
import { hasPermission, permissions, type AuthorizationSubject, type Permission, type Role } from "../permissions";

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function assertPermission(subject: AuthorizationSubject | Role | null | undefined, permission: Permission, message = "Permission denied") {
  if (!hasPermission(subject, permission)) throw new HttpError(403, message);
}
export function assertWorkspaceOwner(subject: AuthorizationSubject | Role | null | undefined, message = "Workspace owner access required") {
  const role = typeof subject === "string" ? subject : subject?.role;
  if (role !== "OWNER") throw new HttpError(403, message);
}
function permissionList(value: unknown): Permission[] | null {
  if (!Array.isArray(value)) return null;
  const allowed = new Set<string>(permissions);
  return value.filter((item): item is Permission => typeof item === "string" && allowed.has(item));
}
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "Authentication required");
  return { id: session.user.id, email: session.user.email! };
}
export async function requireMembership(workspaceId: string) {
  const user = await requireUser();
  const membership = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: user.id } }, include: { customRole: { select: { id: true, name: true, permissions: true } } } });
  if (!membership) throw new HttpError(403, "Workspace access denied");
  if (membership.suspendedAt) throw new HttpError(403, "Your workspace access is suspended");
  const subject: AuthorizationSubject = { role: membership.role as Role, permissions: membership.customRole ? permissionList(membership.customRole.permissions) ?? [] : null, suspendedAt: membership.suspendedAt };
  assertPermission(subject, "WORKSPACE_VIEW", "Workspace access denied");
  return { user, membership, role: membership.role as Role, subject };
}
export async function requireWorkspaceOwner(workspaceId: string) {
  const access = await requireMembership(workspaceId);
  assertWorkspaceOwner(access.subject);
  return access;
}
export async function listUserWorkspaces(userId: string) {
  const workspaces = await prisma.workspace.findMany({
    where: { members: { some: { userId, suspendedAt: null } } },
    select: { id: true, name: true, slug: true, members: { where: { userId, suspendedAt: null }, select: { role: true }, take: 1 } },
    orderBy: { name: "asc" },
  });
  return workspaces.map(({ members, ...workspace }) => ({ ...workspace, role: (members[0]?.role || "VIEWER") as Role }));
}
export async function requireWorkspaceBySlug(slug: string, authenticatedUser?: { id: string; email: string }) {
  const user = authenticatedUser ?? await requireUser();
  const [access] = await prisma.$queryRaw<Array<{ id: string; name: string; slug: string; overloadThreshold: number; dueSoonDays: number; stalledAfterDays: number; role: Role; permissions: unknown }>>`
    SELECT w."id", w."name", w."slug", w."overloadThreshold", w."dueSoonDays", w."stalledAfterDays", wm."role"::text AS "role", cr."permissions"
    FROM "Workspace" w
    INNER JOIN "WorkspaceMember" wm ON wm."workspaceId" = w."id"
    LEFT JOIN "WorkspaceRoleDefinition" cr ON cr."id" = wm."customRoleId" AND cr."workspaceId" = w."id"
    WHERE w."slug" = ${slug} AND wm."userId" = ${user.id} AND wm."suspendedAt" IS NULL
    LIMIT 1
  `;
  if (!access) throw new HttpError(404, "Workspace not found");
  const subject: AuthorizationSubject = { role: access.role as Role, permissions: access.permissions === null ? null : permissionList(access.permissions) ?? [] };
  assertPermission(subject, "WORKSPACE_VIEW", "Workspace access denied");
  return { workspace: { id: access.id, name: access.name, slug: access.slug, overloadThreshold: access.overloadThreshold, dueSoonDays: access.dueSoonDays, stalledAfterDays: access.stalledAfterDays }, user, role: access.role as Role, subject };
}
export function errorResponse(error: unknown) {
  if (error instanceof Response) return error;
  const status = error instanceof HttpError ? error.status : 500;
  if (status === 500) {
    console.error("[TaskFlow API] Unexpected server error", error);
    if (process.env.NODE_ENV === "development") {
      return Response.json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status });
    }
  }
  return Response.json({ error: status === 500 ? "Unexpected server error" : (error as Error).message }, { status });
}
