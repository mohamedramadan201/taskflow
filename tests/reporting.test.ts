import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyManagementSummary, buildWorkspaceReport, parseCompletionDateRange, reportToCsv } from "../src/lib/reporting.ts";

test("completion date ranges use inclusive calendar dates", () => {
  assert.deepEqual(parseCompletionDateRange("2026-08-01", "2026-08-14"), { start: new Date("2026-08-01T00:00:00.000Z"), end: new Date("2026-08-15T00:00:00.000Z") });
  assert.deepEqual(parseCompletionDateRange("2026-08-14", "2026-08-01"), { error: "Start date must be on or before end date." });
  assert.deepEqual(parseCompletionDateRange("bad-date", null), { error: "Enter valid completion dates." });
});

test("workspace report calculates delivery and workload metrics", () => {
  const now = new Date("2026-08-14T00:00:00Z");
  const tasks = [{ status: "DONE", priority: "HIGH", dueAt: null, assigneeUserId: "u1", updatedProductsCount: 12, newProductsCount: 3, updatedImagesCount: 8, newImagesCount: null }, { status: "IN_PROGRESS", priority: "URGENT", dueAt: "2026-08-13T00:00:00Z", assigneeUserId: "u1", updatedProductsCount: null, newProductsCount: 5, updatedImagesCount: null, newImagesCount: 7 }, { status: "TODO", priority: "LOW", dueAt: "2026-08-17T00:00:00Z", assigneeUserId: null, newProductsCount: 2 }];
  const report = buildWorkspaceReport(tasks, [{ user: { id: "u1", name: "Owner", email: "owner@example.com" } }], now);
  assert.equal(report.total, 3); assert.equal(report.completed, 1); assert.equal(report.completionRate, 33); assert.equal(report.overdue, 1); assert.equal(report.dueSoon, 1); assert.equal(report.unassigned, 1); assert.equal(report.workload[0].open, 1); assert.equal(report.workload[0].overdue, 1); assert.equal(report.workload[0].capacityMinutes, 1800);
  assert.deepEqual(report.productAndImageCounts, { updatedProducts: 12, newProducts: 10, updatedImages: 8, newImages: 7, reportingTasks: 3, totalProducts: 22, totalImages: 15, totalOutput: 37 });
  assert.deepEqual(report.outputByMember[0], { user: { id: "u1", name: "Owner", email: "owner@example.com" }, updatedProducts: 12, newProducts: 8, updatedImages: 8, newImages: 7, reportingTasks: 2, totalProducts: 20, totalImages: 15, totalOutput: 35 });
  assert.deepEqual(report.outputByMember[1], { user: { id: "__unassigned__", name: "Unassigned", email: "" }, updatedProducts: 0, newProducts: 2, updatedImages: 0, newImages: 0, reportingTasks: 1, totalProducts: 2, totalImages: 0, totalOutput: 2 });
});

test("workspace report can use a completion-filtered output cohort", () => {
  const tasks = [{ status: "DONE", priority: "HIGH", dueAt: null, assigneeUserId: "u1", updatedProductsCount: 5 }, { status: "TODO", priority: "LOW", dueAt: null, assigneeUserId: "u1", updatedProductsCount: 99 }];
  const outputTasks = [tasks[0]];
  const report = buildWorkspaceReport(tasks, [{ user: { id: "u1", name: "Owner", email: "owner@example.com" } }], new Date("2026-08-14T00:00:00Z"), outputTasks);
  assert.equal(report.total, 2);
  assert.equal(report.productAndImageCounts.updatedProducts, 5);
  assert.equal(report.outputByMember[0].totalOutput, 5);
});

test("no-action tasks are reported without inflating workload or lowering completion", () => {
  const tasks = [
    { id: "done", title: "Delivered", status: "DONE", priority: "MEDIUM", dueAt: null, assigneeUserId: "u1" },
    { id: "parked", title: "Parked", status: "NO_ACTION_NEEDED", priority: "URGENT", dueAt: "2026-08-01T00:00:00Z", assigneeUserId: "u1", estimatedMinutes: 900, remainingMinutes: 900 },
  ];
  const report = buildWorkspaceReport(tasks, [{ user: { id: "u1", name: "Owner", email: "owner@example.com" } }], new Date("2026-08-14T00:00:00Z"));
  assert.equal(report.noActionNeeded, 1);
  assert.equal(report.completionRate, 100);
  assert.equal(report.overdue, 0);
  assert.equal(report.workload[0].open, 0);
  assert.equal(report.workload[0].utilization, 0);
  assert.equal(report.risks.length, 0);
});

test("workspace report exports output and workload as CSV", () => {
  const report = buildWorkspaceReport([], [{ user: { id: "u1", name: "Owner", email: "owner@example.com" } }]);
  assert.match(reportToCsv(report), /"Product & image activity","Count"/); assert.match(reportToCsv(report), /"Total products","0"/); assert.match(reportToCsv(report), /"Output by team member","Tasks reporting"/); assert.match(reportToCsv(report), /"Team member","Capacity hours"/); assert.match(reportToCsv(report), /"Owner","30","0","0%"/);
});

test("workload compares remaining effort with capacity and exposes risk", () => {
  const now = new Date("2026-08-10T09:00:00Z");
  const tasks = [{ id: "t1", title: "Launch", status: "IN_PROGRESS", priority: "URGENT", dueAt: "2026-08-11T12:00:00Z", updatedAt: "2026-08-01T00:00:00Z", assigneeUserId: "u1", estimatedMinutes: 2400, remainingMinutes: 2100, blockedAt: "2026-08-09T00:00:00Z", blockedReason: "Waiting for data" }];
  const report = buildWorkspaceReport(tasks, [{ weeklyCapacityMinutes: 1800, user: { id: "u1", name: "Owner", email: "owner@example.com" } }], now);
  assert.equal(report.overloaded, 1); assert.equal(report.blocked, 1); assert.equal(report.workload[0].utilization, 117); assert.match(report.risks[0].reasons.join(" "), /Waiting for data/);
});

test("dated availability replaces only that day's share of weekly capacity", () => {
  const now = new Date("2026-08-10T09:00:00Z");
  const report = buildWorkspaceReport([], [{ weeklyCapacityMinutes: 1800, availability: [{ date: "2026-08-12", availableMinutes: 0 }], user: { id: "u1", name: "Owner", email: "owner@example.com" } }], now);
  assert.equal(report.workload[0].weekly[0].capacityMinutes, 1440);
});

test("manager action center groups overdue, blocked, unassigned, urgent, unestimated, and overloaded risks", () => {
  const now = new Date("2026-08-14T00:00:00Z");
  const tasks = [
    { id: "overdue", status: "TODO", priority: "MEDIUM", dueAt: "2026-08-13T00:00:00Z", assigneeUserId: "u1", estimatedMinutes: 60 },
    { id: "blocked", status: "IN_PROGRESS", priority: "HIGH", dueAt: null, assigneeUserId: "u1", estimatedMinutes: 60, blockedAt: now },
    { id: "urgent", status: "TODO", priority: "URGENT", dueAt: null, assigneeUserId: "u1", estimatedMinutes: 60 },
    { id: "unassigned", status: "TODO", priority: "LOW", dueAt: null, assigneeUserId: null, estimatedMinutes: 60 },
    { id: "unestimated", status: "TODO", priority: "LOW", dueAt: null, assigneeUserId: "u1", estimatedMinutes: null },
  ];
  const report = buildWorkspaceReport(tasks, [{ weeklyCapacityMinutes: 60, user: { id: "u1", name: "Ahmed", email: "ahmed@example.com" } }], now);
  assert.equal(report.actionCenter.counts.overdue, 1);
  assert.equal(report.actionCenter.counts.blocked, 1);
  assert.equal(report.actionCenter.counts.unassigned, 1);
  assert.equal(report.actionCenter.counts.urgent, 1);
  assert.equal(report.actionCenter.counts.unestimated, 1);
  assert.equal(report.actionCenter.counts.overloaded, 1);
  assert.ok(report.actionCenter.total >= 5);
});

test("weekly management summary calculates current-week activity and workload", () => {
  const now = new Date("2026-08-14T12:00:00Z");
  const tasks = [
    { id: "done", status: "DONE", priority: "MEDIUM", createdAt: "2026-08-10T00:00:00Z", startedAt: "2026-08-11T00:00:00Z", completedAt: "2026-08-12T00:00:00Z", dueAt: null, assigneeUserId: "u1", estimatedMinutes: 60 },
    { id: "overdue", status: "IN_PROGRESS", priority: "URGENT", createdAt: "2026-08-01T00:00:00Z", dueAt: "2026-08-13T00:00:00Z", assigneeUserId: null, estimatedMinutes: null },
    { id: "blocked", status: "TODO", priority: "LOW", createdAt: "2026-08-13T00:00:00Z", dueAt: null, assigneeUserId: "u1", estimatedMinutes: 120, blockedAt: now },
  ];
  const summary = buildWeeklyManagementSummary(tasks, [{ weeklyCapacityMinutes: 60, user: { id: "u1", name: "Ahmed", email: "ahmed@example.com" } }], now);
  assert.equal(summary.completedThisWeek, 1);
  assert.equal(summary.createdThisWeek, 2);
  assert.equal(summary.openTasks, 2);
  assert.equal(summary.overdue, 1);
  assert.equal(summary.blocked, 1);
  assert.equal(summary.urgentOpen, 1);
  assert.equal(summary.unassigned, 1);
  assert.equal(summary.overloaded, 1);
  assert.equal(summary.averageCycleDays, 1);
});
