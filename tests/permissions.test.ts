import test from "node:test";
import assert from "node:assert/strict";
import { canAssignTaskTo, canAssignWorkspaceRole, canCreateTask, canDeleteTask, canModifyTask, customRolePermissions, effectivePermissions, hasPermission, permissions } from "../src/lib/permissions.ts";

test("owner receives every defined permission", () => {
  for (const permission of permissions) assert.equal(hasPermission("OWNER", permission), true, permission);
});

test("unknown or missing subjects are denied by default", () => {
  assert.equal(hasPermission(null, "WORKSPACE_VIEW"), false);
  assert.equal(hasPermission(undefined, "TASK_CREATE"), false);
});

test("suspended members have no effective permissions", () => {
  assert.equal(effectivePermissions({ role: "OWNER", suspendedAt: new Date() }).size, 0);
});

test("explicit permission sets replace role defaults", () => {
  const subject = { role: "VIEWER" as const, permissions: ["TASK_COMMENT" as const] };
  assert.equal(hasPermission(subject, "TASK_COMMENT"), true);
  assert.equal(hasPermission(subject, "WORKSPACE_VIEW"), false);
});

test("custom roles cannot delegate owner-only administration", () => {
  for (const permission of ["WORKSPACE_DELETE", "ROLE_MANAGE", "CUSTOM_ROLE_MANAGE"] as const) assert.equal(customRolePermissions.includes(permission), false);
});

test("owner can assign every workspace role", () => {
  for (const role of ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const) assert.equal(canAssignWorkspaceRole("OWNER", role), true);
});

test("admin can only assign member or viewer", () => {
  assert.equal(canAssignWorkspaceRole("ADMIN", "MEMBER"), true);
  assert.equal(canAssignWorkspaceRole("ADMIN", "VIEWER"), true);
  assert.equal(canAssignWorkspaceRole("ADMIN", "ADMIN"), false);
  assert.equal(canAssignWorkspaceRole("ADMIN", "OWNER"), false);
});

test("viewer cannot create tasks", () => assert.equal(canCreateTask("VIEWER"), false));

test("member modifies only owned or assigned tasks", () => {
  const other = { createdByUserId: "other", assigneeUserId: null };
  assert.equal(canModifyTask("MEMBER", "me", other), false);
  assert.equal(canModifyTask("MEMBER", "me", { ...other, createdByUserId: "me" }), true);
  assert.equal(canModifyTask("MEMBER", "me", { ...other, assigneeUserId: "me" }), true);
});

test("member deletes only tasks they created", () => {
  assert.equal(canDeleteTask("MEMBER", "me", { createdByUserId: "me" }), true);
  assert.equal(canDeleteTask("MEMBER", "me", { createdByUserId: "other" }), false);
});

test("member assignment is limited to self or unassigned", () => {
  assert.equal(canAssignTaskTo("MEMBER", "me", "me"), true);
  assert.equal(canAssignTaskTo("MEMBER", "me", null), true);
  assert.equal(canAssignTaskTo("MEMBER", "me", "other"), false);
  assert.equal(canAssignTaskTo("ADMIN", "me", "other"), true);
});
