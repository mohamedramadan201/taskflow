import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import nodemailer from "nodemailer";
import { getEmailDeliveryConfig } from "../email-delivery";

export async function sendNotificationEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  const config = getEmailDeliveryConfig();
  if (config.mode === "log") {
    const file = resolve(config.logPath);
    await mkdir(dirname(file), { recursive: true });
    await appendFile(file, JSON.stringify({ timestamp: new Date().toISOString(), from: config.from, to, subject, text }) + "\n", "utf8");
    return;
  }
  const transport = nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });
  await transport.sendMail({ from: config.from, to, subject, text });
}
