import assert from "node:assert/strict";
import test from "node:test";
import { emailMonitorMessageIsExcluded, evaluateEmailMonitorThread, monitorNeedsAction } from "../src/lib/email-monitor.ts";

const config = { targetAddress: "ecommerce.catalog@example.com", responderEmails: ["catalog.owner@example.com"], slaHours: 4, excludedSenderEmails: [], excludedSubjectKeywords: [] };
const now = new Date("2026-08-23T12:00:00Z");
const incoming = (at: string, sender = "vendor@example.com") => ({ senderAddress: sender, toAddresses: ["ecommerce.catalog@example.com"], ccAddresses: [], subject: "Product update", receivedAt: at });

test("monitor waits for the SLA, then marks an overdue external message as needing reply", () => {
  const waiting = evaluateEmailMonitorThread([incoming("2026-08-23T09:00:00Z")], config, now);
  assert.equal(waiting.status, "WAITING");
  const overdue = evaluateEmailMonitorThread([incoming("2026-08-23T07:00:00Z")], config, now);
  assert.equal(overdue.status, "NEEDS_REPLY");
  assert.equal(overdue.agingBucket, "4-8h");
  assert.equal(monitorNeedsAction(overdue.status), true);
});

test("a configured responder handles the thread but does not remove task conversion capability", () => {
  const result = evaluateEmailMonitorThread([incoming("2026-08-23T06:00:00Z"), incoming("2026-08-23T08:00:00Z", "catalog.owner@example.com")], config, now);
  assert.equal(result.status, "HANDLED");
  assert.equal(monitorNeedsAction(result.status), false);
  assert.equal(result.latestRelevantSenderAddress, "catalog.owner@example.com");
});

test("a later external reply reopens a previously handled thread", () => {
  const result = evaluateEmailMonitorThread([incoming("2026-08-23T06:00:00Z"), incoming("2026-08-23T07:00:00Z", "catalog.owner@example.com"), incoming("2026-08-23T07:30:00Z")], config, now, true);
  assert.equal(result.status, "REOPENED");
  assert.equal(result.latestExternalMessageAt?.toISOString(), "2026-08-23T07:30:00.000Z");
});

test("direct messages to a team member are not monitored", () => {
  const result = evaluateEmailMonitorThread([{ ...incoming("2026-08-23T06:00:00Z"), toAddresses: ["catalog.owner@example.com"] }], config, now);
  assert.equal(result.status, "WAITING");
  assert.equal(result.latestRelevantMessageAt, null);
});

test("excluded sender and subject messages do not create a pending thread", () => {
  const result = evaluateEmailMonitorThread([incoming("2026-08-23T06:00:00Z", "no-reply@example.com"), { ...incoming("2026-08-23T06:00:00Z"), subject: "System alert" }], { ...config, excludedSenderEmails: ["no-reply@example.com"], excludedSubjectKeywords: ["system alert"] }, now);
  assert.equal(result.status, "WAITING");
});

test("configured monitor exclusions also prevent inbox capture", () => {
  const excludedConfig = { excludedSenderEmails: ["no-reply@example.com"], excludedSubjectKeywords: ["system alert"] };
  assert.equal(emailMonitorMessageIsExcluded(incoming("2026-08-23T06:00:00Z", "NO-REPLY@example.com"), excludedConfig), true);
  assert.equal(emailMonitorMessageIsExcluded({ ...incoming("2026-08-23T06:00:00Z"), subject: "Daily SYSTEM ALERT" }, excludedConfig), true);
  assert.equal(emailMonitorMessageIsExcluded(incoming("2026-08-23T06:00:00Z"), excludedConfig), false);
});
