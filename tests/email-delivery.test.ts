import test from "node:test";
import assert from "node:assert/strict";
import { buildEmailDeliverySubject, getEmailDeliveryConfig } from "../src/lib/email-delivery.ts";
test("email delivery has safe log defaults", () => assert.deepEqual(getEmailDeliveryConfig({}), { mode: "log", from: "TaskFlow <notifications@taskflow.local>", logPath: "./var/email-delivery.jsonl" }));
test("smtp config parses values and optional auth", () => assert.deepEqual(getEmailDeliveryConfig({ EMAIL_DELIVERY_MODE: "smtp", SMTP_HOST: "mail.local", SMTP_PORT: "2526", SMTP_SECURE: "true", SMTP_USER: "u", SMTP_PASS: "p", EMAIL_FROM: "hello@example.com" }), { mode: "smtp", from: "hello@example.com", host: "mail.local", port: 2526, secure: true, user: "u", pass: "p" }));
test("subjects are consistent", () => { assert.equal(buildEmailDeliverySubject("TASK_REMINDER"), "[TaskFlow] Task reminder"); assert.equal(buildEmailDeliverySubject("UNKNOWN"), "[TaskFlow] Notification"); });
