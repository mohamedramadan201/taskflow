export type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export const permissions = [
  "WORKSPACE_VIEW",
  "WORKSPACE_MANAGE",
  "WORKSPACE_DELETE",
  "TASK_CREATE",
  "TASK_EDIT_ANY",
  "TASK_EDIT_OWN",
  "TASK_DELETE_ANY",
  "TASK_DELETE_OWN",
  "TASK_ASSIGN_ANY",
  "TASK_ASSIGN_SELF",
  "TASK_COMMENT",
  "TASK_CHECKLIST",
  "TASK_REMINDER",
  "MEMBER_VIEW",
  "MEMBER_INVITE",
  "MEMBER_MANAGE",
  "ROLE_MANAGE",
  "REPORT_VIEW",
  "REPORT_EXPORT",
  "AUDIT_VIEW",
  "CUSTOM_ROLE_MANAGE",
  "EMAIL_VIEW",
  "EMAIL_TRIAGE",
  "EMAIL_CONNECTOR_MANAGE",
] as const;

export type Permission = (typeof permissions)[number];
export const customRolePermissions = permissions.filter((permission) => !(["WORKSPACE_DELETE", "ROLE_MANAGE", "CUSTOM_ROLE_MANAGE", "REPORT_VIEW", "REPORT_EXPORT", "EMAIL_CONNECTOR_MANAGE"] as Permission[]).includes(permission));

const allPermissions = new Set<Permission>(permissions);

export const ROLE_PERMISSIONS: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  OWNER: allPermissions,
  ADMIN: new Set<Permission>([
    "WORKSPACE_VIEW", "WORKSPACE_MANAGE", "TASK_CREATE", "TASK_EDIT_ANY", "TASK_DELETE_ANY",
    "TASK_ASSIGN_ANY", "TASK_COMMENT", "TASK_CHECKLIST", "TASK_REMINDER", "MEMBER_VIEW",
    "MEMBER_INVITE", "MEMBER_MANAGE", "AUDIT_VIEW",
    "EMAIL_VIEW", "EMAIL_TRIAGE",
  ]),
  MEMBER: new Set<Permission>([
    "WORKSPACE_VIEW", "TASK_CREATE", "TASK_EDIT_OWN", "TASK_DELETE_OWN", "TASK_ASSIGN_SELF",
    "TASK_COMMENT", "TASK_CHECKLIST", "TASK_REMINDER", "MEMBER_VIEW", "EMAIL_VIEW", "EMAIL_TRIAGE",
  ]),
  VIEWER: new Set<Permission>(["WORKSPACE_VIEW", "MEMBER_VIEW", "EMAIL_VIEW"]),
};

export type AuthorizationSubject = {
  role: Role;
  permissions?: Iterable<Permission> | null;
  suspendedAt?: Date | string | null;
};

export function effectivePermissions(subject: AuthorizationSubject): ReadonlySet<Permission> {
  if (subject.suspendedAt) return new Set();
  return subject.permissions ? new Set(subject.permissions) : ROLE_PERMISSIONS[subject.role];
}

export function hasPermission(subject: AuthorizationSubject | Role | null | undefined, permission: Permission) {
  if (!subject) return false;
  const normalized = typeof subject === "string" ? { role: subject } : subject;
  return effectivePermissions(normalized).has(permission);
}

export const canViewWorkspace = (role?: Role | null) => hasPermission(role, "WORKSPACE_VIEW");
export const canManageWorkspaceMembers = (role?: Role | null) => hasPermission(role, "MEMBER_MANAGE");
export const canCreateTask = (role?: Role | null) => hasPermission(role, "TASK_CREATE");
export const canAssignWorkspaceRole = (actorRole: Role, targetRole: Role) =>
  actorRole === "OWNER" || (actorRole === "ADMIN" && (targetRole === "MEMBER" || targetRole === "VIEWER"));

type TaskOwnership = { createdByUserId: string; assigneeUserId?: string | null };

export function canModifyTask(subject: AuthorizationSubject | Role | null | undefined, actorUserId: string, task: TaskOwnership) {
  if (hasPermission(subject, "TASK_EDIT_ANY")) return true;
  return hasPermission(subject, "TASK_EDIT_OWN") && (task.createdByUserId === actorUserId || task.assigneeUserId === actorUserId);
}

export function canDeleteTask(subject: AuthorizationSubject | Role | null | undefined, actorUserId: string, task: TaskOwnership) {
  if (hasPermission(subject, "TASK_DELETE_ANY")) return true;
  return hasPermission(subject, "TASK_DELETE_OWN") && task.createdByUserId === actorUserId;
}

export function canAssignTaskTo(subject: AuthorizationSubject | Role | null | undefined, actorUserId: string, targetUserId: string | null | undefined) {
  if (hasPermission(subject, "TASK_ASSIGN_ANY")) return true;
  return hasPermission(subject, "TASK_ASSIGN_SELF") && (!targetUserId || targetUserId === actorUserId);
}
