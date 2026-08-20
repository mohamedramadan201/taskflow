import assert from "node:assert/strict";
import test from "node:test";
import { allTaskIdsBelongToWorkspace, bulkTaskFailure } from "../src/lib/bulk-task.ts";
import { statusUpdateFields } from "../src/lib/task-status.ts";
import { taskBulkActionSchema } from "../src/lib/validation.ts";

test("bulk payload accepts multiple task updates with one action", () => {
  const result = taskBulkActionSchema.safeParse({ taskIds: ["t1", "t2", "t3"], action: "PRIORITY", priority: "HIGH" });
  assert.equal(result.success, true);
});

test("bulk task authorization preserves normal member permissions", () => {
  const subject = { role: "MEMBER" as const };
  const task = { id: "t1", workspaceId: "w1", createdByUserId: "owner", assigneeUserId: "member" };
  assert.equal(bulkTaskFailure(subject, "member", task, "PRIORITY", undefined), null);
  assert.equal(bulkTaskFailure(subject, "member", task, "ASSIGN", "other"), "Task assignment denied");
  assert.equal(bulkTaskFailure(subject, "other", task, "STATUS", undefined), "Task modification denied");
});

test("bulk task authorization rejects cross-workspace selections", () => {
  assert.equal(allTaskIdsBelongToWorkspace(["t1", "t2"], [{ id: "t1", workspaceId: "w1" }, { id: "t2", workspaceId: "w2" }], "w1"), false);
  assert.equal(allTaskIdsBelongToWorkspace(["t1", "t1"], [{ id: "t1", workspaceId: "w1" }], "w1"), true);
});

test("bulk status changes preserve timestamp semantics", () => {
  const now = new Date("2026-08-20T10:00:00Z");
  assert.deepEqual(statusUpdateFields({ status: "TODO", startedAt: null, completedAt: null }, "IN_PROGRESS", now), { startedAt: now, completedAt: null, remainingMinutes: undefined });
  assert.deepEqual(statusUpdateFields({ status: "IN_PROGRESS", startedAt: new Date("2026-08-19T10:00:00Z"), completedAt: null }, "DONE", now), { startedAt: new Date("2026-08-19T10:00:00Z"), completedAt: now, remainingMinutes: 0 });
  assert.deepEqual(statusUpdateFields({ status: "DONE", startedAt: now, completedAt: now }, "TODO", now), { startedAt: null, completedAt: null, remainingMinutes: undefined });
});
