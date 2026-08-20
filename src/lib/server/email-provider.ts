import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import nodemailer from "nodemailer";
import { buildEmailDeliverySubject, getEmailDeliveryConfig } from "../email-delivery";

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

export async function sendWorkspaceInvitationEmail({ to, token, workspaceName, role, inviterName, publicUrl }: { to: string; token: string; workspaceName: string; role: string; inviterName: string; publicUrl: string }) {
  const invitationUrl = new URL(`/invite/${token}`, publicUrl).toString();
  await sendNotificationEmail({
    to,
    subject: buildEmailDeliverySubject("WORKSPACE_INVITATION"),
    text: `You have been invited by ${inviterName} to join the ${workspaceName} space on TaskFlow as a ${role.toLowerCase()}.

Open this link to accept the invitation:
${invitationUrl}

This invitation expires in 7 days. If you were not expecting it, you can ignore this email.`,
  });
}
