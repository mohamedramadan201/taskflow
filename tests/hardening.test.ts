import assert from "node:assert/strict";
import test from "node:test";
import { hashInvitationToken } from "../src/lib/server/invitations.ts";
import { telegramRetryDelayMs } from "../src/lib/server/telegram-retry.ts";

test("invitation tokens are stored as one-way hashes", () => {
  assert.equal(hashInvitationToken("invite-token"), hashInvitationToken("invite-token"));
  assert.notEqual(hashInvitationToken("invite-token"), "invite-token");
  assert.notEqual(hashInvitationToken("invite-token"), hashInvitationToken("other-token"));
});

test("Telegram retry backoff is bounded and increases per attempt", () => {
  assert.equal(telegramRetryDelayMs(1), 5_000);
  assert.equal(telegramRetryDelayMs(2), 10_000);
  assert.equal(telegramRetryDelayMs(20), 300_000);
});
