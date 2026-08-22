import assert from "node:assert/strict";
import test from "node:test";
import { getNextReminderDate, matchesReminderFilter, normalizeReminderEmails, normalizeReminderTags } from "../src/lib/workspace-reminders.ts";

test("reminder recipients and tags are normalized without duplicates", () => {
  assert.deepEqual(normalizeReminderEmails("A@example.com, a@example.com; B@example.com"), ["a@example.com", "b@example.com"]);
  assert.deepEqual(normalizeReminderTags("Catalog, catalog; Merch"), ["Catalog", "Merch"]);
});

test("recurring reminders advance past the current time", () => {
  const next = getNextReminderDate(new Date("2026-08-20T09:00:00Z"), "DAILY", 1, new Date("2026-08-22T10:00:00Z"));
  assert.equal(next?.toISOString(), "2026-08-23T09:00:00.000Z");
});

test("reminder filters distinguish overdue, today, and assigned reminders", () => {
  const now = new Date("2026-08-22T10:00:00Z");
  const base = { status: "PENDING", repeatType: "NONE", assignedEmails: ["sara@example.com"], reminderAt: new Date("2026-08-22T12:00:00Z") };
  assert.equal(matchesReminderFilter(base, "today", "owner@example.com", now), true);
  assert.equal(matchesReminderFilter({ ...base, reminderAt: new Date("2026-08-21T12:00:00Z") }, "overdue", "owner@example.com", now), true);
  assert.equal(matchesReminderFilter(base, "assignedToMe", "SARA@example.com", now), true);
});
