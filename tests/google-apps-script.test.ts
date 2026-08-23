import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const code = readFileSync(new URL("../integrations/google-apps-script/Code.gs", import.meta.url), "utf8");

test("Apps Script manual sync requests the configured lookback window", () => {
  assert.match(code, /syncRequestedAt \|\| !config\.historyId/);
  assert.match(code, /gmailMessagesFromLookback_\(config\.monitor && config\.monitor\.lookbackDays\)/);
  assert.match(code, /Gmail\.Users\.Messages\.list\("me", \{ maxResults: 500, pageToken: pageToken \}\)/);
  assert.doesNotMatch(code, /q: "newer_than:/);
  assert.match(code, /new Date\(item\.receivedAt\)\.getTime\(\) >= cutoff/);
});

test("Apps Script isolates unavailable Gmail messages from the full mailbox sync", () => {
  assert.match(code, /function gmailMessageGet_\(id, options\)/);
  assert.match(code, /function gmailThreadGet_\(id, options\)/);
  assert.match(code, /gmailMessageGet_\(id, \{/);
  assert.match(code, /gmailThreadGet_\(threadId, \{/);
  assert.match(code, /precondition/i);
  assert.match(code, /Skipping unavailable Gmail message/);
});

test("Apps Script batches emails and thread snapshots within the ingest API limit", () => {
  assert.match(code, /function chunkValues_\(values, size\)/);
  assert.match(code, /var emailChunks = chunkValues_\(messages, 50\)/);
  assert.match(code, /snapshotChunks = chunkValues_\(threadSnapshots, 50\)/);
  assert.match(code, /threadSnapshots: snapshotChunks\[batchIndex\] \|\| \[\]/);
});
