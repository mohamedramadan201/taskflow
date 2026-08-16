import test from "node:test";
import assert from "node:assert/strict";
import { connectorIsDue, connectorTokenMatches, createConnectorToken, emailPassesRules, hashConnectorToken } from "../src/lib/email-connectors.ts";
import { normalizePublicHttpsUrl } from "../src/lib/public-app-url.ts";

const message = { senderAddress: "alerts@supplier.com", toAddresses: ["Catalog@Company.com"], ccAddresses: [], deliveredTo: [] };

test("connector tokens are hashed and compared safely", () => {
  const token = createConnectorToken();
  assert.equal(connectorTokenMatches(token, hashConnectorToken(token)), true);
  assert.equal(connectorTokenMatches(`${token}x`, hashConnectorToken(token)), false);
});

test("exclusions win over inclusions", () => {
  const rules = [
    { action: "INCLUDE", field: "SENDER", matchType: "DOMAIN", value: "supplier.com" },
    { action: "EXCLUDE", field: "SENDER", matchType: "EXACT", value: "alerts@supplier.com" },
  ] as const;
  assert.equal(emailPassesRules(message, "catalog@company.com", [...rules]), false);
});

test("sender and recipient includes are both required", () => {
  const rules = [
    { action: "INCLUDE", field: "SENDER", matchType: "DOMAIN", value: "@supplier.com" },
    { action: "INCLUDE", field: "RECIPIENT", matchType: "EXACT", value: "catalog@company.com" },
  ] as const;
  assert.equal(emailPassesRules(message, "catalog@company.com", [...rules]), true);
  assert.equal(emailPassesRules({ ...message, senderAddress: "person@other.com" }, "catalog@company.com", [...rules]), false);
});

test("mailbox address is always a receiver candidate for BCC delivery", () => {
  const rules = [{ action: "INCLUDE", field: "RECIPIENT", matchType: "EXACT", value: "private@company.com" }] as const;
  assert.equal(emailPassesRules({ ...message, toAddresses: [] }, "private@company.com", [...rules]), true);
});

test("logical schedule supports interval, manual sync, and pause", () => {
  const now = new Date("2026-08-16T10:10:00Z");
  assert.equal(connectorIsDue({ enabled: true, syncIntervalMinutes: 5, lastSyncAt: new Date("2026-08-16T10:04:59Z"), syncRequestedAt: null }, now), true);
  assert.equal(connectorIsDue({ enabled: true, syncIntervalMinutes: 30, lastSyncAt: new Date("2026-08-16T10:09:00Z"), syncRequestedAt: new Date("2026-08-16T10:09:30Z") }, now), true);
  assert.equal(connectorIsDue({ enabled: false, syncIntervalMinutes: 1, lastSyncAt: null, syncRequestedAt: new Date() }, now), false);
});

test("Apps Script setup accepts only public HTTPS origins", () => {
  assert.equal(normalizePublicHttpsUrl("http://localhost:3000"), null);
  assert.equal(normalizePublicHttpsUrl("https://127.0.0.1:3000"), null);
  assert.equal(normalizePublicHttpsUrl("https://192.168.1.12"), null);
  assert.equal(normalizePublicHttpsUrl("https://taskflow.example.com/path"), "https://taskflow.example.com");
});
