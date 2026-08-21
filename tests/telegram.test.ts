import test from "node:test";
import assert from "node:assert/strict";
import { parseTelegramCommand } from "../src/lib/telegram-command.ts";

test("Telegram task and note commands preserve their titles", () => {
  assert.deepEqual(parseTelegramCommand("/task Prepare the launch brief"), { command: "task", argument: "Prepare the launch brief" });
  assert.deepEqual(parseTelegramCommand("/note@taskflow_bot Follow up with Ahmed"), { command: "note", argument: "Follow up with Ahmed" });
});

test("Telegram command parser rejects ordinary text", () => {
  assert.equal(parseTelegramCommand("Prepare the launch brief"), null);
});
