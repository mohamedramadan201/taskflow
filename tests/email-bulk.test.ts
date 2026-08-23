import assert from "node:assert/strict";
import test from "node:test";
import { emailBulkActionSchema } from "../src/lib/validation.ts";

test("email bulk actions accept the full visible inbox selection", () => {
  const emailIds = Array.from({ length: 110 }, (_, index) => `email-${index + 1}`);
  const result = emailBulkActionSchema.safeParse({
    emailIds,
    action: "NO_ACTION_NEEDED",
    assigneeUserId: null,
  });

  assert.equal(result.success, true);
});

test("email bulk actions still reject unbounded selections", () => {
  const emailIds = Array.from({ length: 501 }, (_, index) => `email-${index + 1}`);
  const result = emailBulkActionSchema.safeParse({
    emailIds,
    action: "DISMISS",
    assigneeUserId: null,
  });

  assert.equal(result.success, false);
});
