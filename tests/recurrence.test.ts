import assert from "node:assert/strict";
import test from "node:test";
import { nextRecurringDate } from "../src/lib/recurrence.ts";

test("recurrence advances daily and weekly intervals", () => {
  assert.equal(nextRecurringDate(new Date("2026-08-14T09:00:00Z"), "DAILY", 2).toISOString(), "2026-08-16T09:00:00.000Z");
  assert.equal(nextRecurringDate(new Date("2026-08-14T09:00:00Z"), "WEEKLY", 2).toISOString(), "2026-08-28T09:00:00.000Z");
});

test("monthly recurrence clamps to the final day of shorter months", () => {
  assert.equal(nextRecurringDate(new Date("2027-01-31T09:00:00Z"), "MONTHLY", 1).toISOString(), "2027-02-28T09:00:00.000Z");
});
