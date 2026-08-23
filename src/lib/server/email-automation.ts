import { randomBytes } from "node:crypto";
import { buildEmailDeliverySubject, getEmailDeliveryConfig } from "../email-delivery";
import { taskflowPublicUrl } from "../public-app-url";
import { prisma } from "./prisma";
import { buildWorkspaceInvitationEmail } from "./email-provider";
import { hashInvitationToken } from "./invitations";

const CLAIM_LEASE_MS = 10 * 60 * 1000;

export type AutomationEmailWork = {
  kind: "INVITATION" | "NOTIFICATION" | "MONITOR_SUMMARY";
  id: string;
  to: string;
  subject: string;
  body: string;
};

async function claimMonitorSummary(connector: { id: string; workspaceId: string; displayName: string | null; mailboxAddress: string; monitorSummaryRecipients: string[]; monitorSummaryEveryHours: number }, now: Date) {
  if (!connector.monitorSummaryRecipients.length) return null;
  const claimed = await prisma.emailConnector.updateMany({ where: { id: connector.id, monitorEnabled: true, OR: [{ monitorSummaryClaimedAt: null }, { monitorSummaryClaimedAt: { lt: new Date(now.getTime() - CLAIM_LEASE_MS) } }] }, data: { monitorSummaryClaimedAt: now, monitorSummaryLastError: null } });
  if (!claimed.count) return null;
  const threads = await prisma.emailMonitorThread.findMany({ where: { connectorId: connector.id, status: { in: ["NEEDS_REPLY", "REOPENED"] } }, orderBy: [{ priority: "desc" }, { latestExternalMessageAt: "asc" }], take: 100 });
  if (!threads.length) {
    await prisma.emailConnector.update({ where: { id: connector.id }, data: { monitorSummaryClaimedAt: null } });
    return null;
  }
  const counts = { "4-8h": 0, "8-24h": 0, "24h+": 0 };
  const top = [] as Array<{ subject: string; sender: string; receivedAt: Date; agingBucket: string | null }>;
  for (const thread of threads) {
    if (thread.agingBucket && thread.agingBucket in counts) counts[thread.agingBucket as keyof typeof counts] += 1;
  }
  for (const thread of threads.slice(0, 10)) {
    const email = await prisma.inboundEmail.findFirst({ where: { connectorId: connector.id, gmailThreadId: thread.gmailThreadId }, orderBy: { receivedAt: "desc" }, select: { subject: true, senderAddress: true, receivedAt: true } });
    top.push({ subject: email?.subject || "(No subject)", sender: email?.senderAddress || thread.latestRelevantSenderAddress || "Unknown sender", receivedAt: thread.latestExternalMessageAt || email?.receivedAt || now, agingBucket: thread.agingBucket });
  }
  let body = `Reply monitoring summary for ${connector.displayName || connector.mailboxAddress}\n\n`;
  body += `${threads.length} email thread${threads.length === 1 ? "" : "s"} need${threads.length === 1 ? "s" : ""} action.\n`;
  body += `- ${counts["4-8h"]} pending 4-8 hours\n- ${counts["8-24h"]} pending 8-24 hours\n- ${counts["24h+"]} pending 24+ hours\n\nTop pending threads:\n`;
  top.forEach((item, index) => { body += `\n${index + 1}. ${item.subject}\n   Sender: ${item.sender}\n   Waiting since: ${item.receivedAt.toISOString()}\n   Aging: ${item.agingBucket || "Overdue"}\n`; });
  return { kind: "MONITOR_SUMMARY" as const, id: connector.id, to: connector.monitorSummaryRecipients.join(","), subject: `[TaskFlow] Reply monitoring summary — ${connector.displayName || connector.mailboxAddress}`, body };
}

async function prepareReminderQueue(workspaceId: string, limit: number) {
  const due = await prisma.reminder.findMany({
    where: { workspaceId, status: { in: ["PENDING", "FAILED"] }, scheduledAt: { lte: new Date() }, attempts: { lt: 3 }, notificationId: null },
    include: { task: { select: { title: true } }, user: { select: { email: true } } },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });
  let queued = 0;
  for (const reminder of due) {
    const prepared = await prisma.$transaction(async (tx) => {
      const claimed = await tx.reminder.updateMany({ where: { id: reminder.id, status: { in: ["PENDING", "FAILED"] }, attempts: { lt: 3 }, notificationId: null }, data: { status: "PROCESSING", attempts: { increment: 1 } } });
      if (!claimed.count) return false;
      const notification = await tx.notification.create({ data: { workspaceId: reminder.workspaceId, userId: reminder.userId, taskId: reminder.taskId, type: "TASK_REMINDER", message: `Reminder: ${reminder.task.title}`, emailTo: reminder.user.email, emailSubject: buildEmailDeliverySubject("TASK_REMINDER") } });
      await tx.reminder.update({ where: { id: reminder.id }, data: { notificationId: notification.id } });
      return true;
    });
    if (prepared) queued += 1;
  }
  return queued;
}

async function claimInvitation(invitation: { id: string; email: string; tokenHash: string; role: string; expiresAt: Date; workspace: { name: string }; invitedBy: { email: string } }, now: Date, publicUrl: string) {
  const token = randomBytes(24).toString("hex");
  const claimed = await prisma.workspaceInvitation.updateMany({ where: { id: invitation.id, acceptedAt: null, expiresAt: { gt: now }, emailStatus: { in: ["PENDING", "FAILED"] }, emailAttempts: { lt: 3 }, OR: [{ emailClaimedAt: null }, { emailClaimedAt: { lt: new Date(now.getTime() - CLAIM_LEASE_MS) } }] }, data: { tokenHash: hashInvitationToken(token), emailClaimedAt: now, emailAttempts: { increment: 1 } } });
  if (!claimed.count) return null;
  const email = buildWorkspaceInvitationEmail({ to: invitation.email, token, workspaceName: invitation.workspace.name, role: invitation.role, inviterName: invitation.invitedBy.email, publicUrl });
  return { kind: "INVITATION" as const, id: invitation.id, to: invitation.email, subject: email.subject, body: email.text };
}

async function claimNotification(notification: { id: string; emailTo: string | null; emailSubject: string | null; type: string; message: string; task: { title: string } | null; workspace: { name: string }; user: { email: string; emailNotifications: boolean; taskReminderNotifications: boolean }; reminder: { id: string } | null }, now: Date) {
  if (!notification.emailTo || !notification.user.emailNotifications || (notification.type === "TASK_REMINDER" && !notification.user.taskReminderNotifications)) {
    await prisma.$transaction(async (tx) => {
      await tx.notification.update({ where: { id: notification.id }, data: { emailStatus: "SKIPPED", emailLastError: "Disabled by notification preferences", emailClaimedAt: null } });
      if (notification.reminder) await tx.reminder.update({ where: { id: notification.reminder.id }, data: { status: "CANCELLED", processedAt: now, lastError: "Disabled by notification preferences" } });
    });
    return null;
  }
  const claimed = await prisma.notification.updateMany({
    where: { id: notification.id, emailStatus: { in: ["PENDING", "FAILED"] }, emailAttempts: { lt: 3 }, OR: [{ emailClaimedAt: null }, { emailClaimedAt: { lt: new Date(now.getTime() - CLAIM_LEASE_MS) } }] },
    data: { emailClaimedAt: now, emailAttempts: { increment: 1 } },
  });
  if (!claimed.count) return null;
  const taskLine = notification.task ? `\nTask: ${notification.task.title}` : "";
  return { kind: "NOTIFICATION" as const, id: notification.id, to: notification.emailTo, subject: notification.emailSubject || buildEmailDeliverySubject(notification.type), body: `${notification.message}\n\nWorkspace: ${notification.workspace.name}${taskLine}\n\nOpen TaskFlow to review the task.` };
}

export async function claimEmailWork(workspaceId: string, requestUrl: string, limit = 25) {
  if (getEmailDeliveryConfig().mode !== "apps_script") return [];
  const safeLimit = Math.max(1, Math.min(limit, 50));
  await prepareReminderQueue(workspaceId, safeLimit);
  const now = new Date();
  const publicUrl = taskflowPublicUrl(requestUrl);
  if (!publicUrl) throw new Error("TASKFLOW_PUBLIC_URL is not configured");
  const work: AutomationEmailWork[] = [];
  const monitorConnectors = await prisma.emailConnector.findMany({ where: { workspaceId, enabled: true, monitorEnabled: true }, select: { id: true, workspaceId: true, displayName: true, mailboxAddress: true, monitorSummaryRecipients: true, monitorSummaryEveryHours: true, monitorLastSummaryAt: true, monitorSummaryClaimedAt: true }, orderBy: { createdAt: "asc" }, take: safeLimit });
  for (const connector of monitorConnectors) {
    if (work.length >= safeLimit || !connector.monitorSummaryRecipients.length) break;
    const dueAt = connector.monitorLastSummaryAt ? new Date(connector.monitorLastSummaryAt.getTime() + connector.monitorSummaryEveryHours * 3_600_000) : now;
    const claimExpired = !connector.monitorSummaryClaimedAt || connector.monitorSummaryClaimedAt.getTime() < now.getTime() - CLAIM_LEASE_MS;
    if (dueAt > now || !claimExpired) continue;
    const item = await claimMonitorSummary(connector, now);
    if (item) work.push(item);
  }
  const invitations = await prisma.workspaceInvitation.findMany({ where: { workspaceId, acceptedAt: null, expiresAt: { gt: now }, emailStatus: { in: ["PENDING", "FAILED"] }, emailAttempts: { lt: 3 }, OR: [{ emailClaimedAt: null }, { emailClaimedAt: { lt: new Date(now.getTime() - CLAIM_LEASE_MS) } }] }, include: { workspace: { select: { name: true } }, invitedBy: { select: { email: true } } }, orderBy: { createdAt: "asc" }, take: safeLimit });
  for (const invitation of invitations) {
    if (work.length >= safeLimit) break;
    const item = await claimInvitation(invitation, now, publicUrl);
    if (item) work.push(item);
  }
  if (work.length >= safeLimit) return work;
  const notifications = await prisma.notification.findMany({ where: { workspaceId, emailStatus: { in: ["PENDING", "FAILED"] }, emailAttempts: { lt: 3 }, OR: [{ emailClaimedAt: null }, { emailClaimedAt: { lt: new Date(now.getTime() - CLAIM_LEASE_MS) } }] }, include: { task: { select: { title: true } }, workspace: { select: { name: true } }, user: { select: { email: true, emailNotifications: true, taskReminderNotifications: true } }, reminder: { select: { id: true } } }, orderBy: { createdAt: "asc" }, take: safeLimit });
  for (const notification of notifications) {
    if (work.length >= safeLimit) break;
    const item = await claimNotification(notification, now);
    if (item) work.push(item);
  }
  return work;
}

export async function completeEmailWork(workspaceId: string, input: { kind: "INVITATION" | "NOTIFICATION" | "MONITOR_SUMMARY"; id: string; success: boolean; error?: string | null }) {
  const now = new Date();
  const message = input.error?.slice(0, 500) || "Apps Script delivery failed";
  if (input.kind === "MONITOR_SUMMARY") {
    const result = await prisma.emailConnector.updateMany({ where: { id: input.id, workspaceId }, data: input.success ? { monitorLastSummaryAt: now, monitorSummaryClaimedAt: null, monitorSummaryLastError: null } : { monitorSummaryClaimedAt: null, monitorSummaryLastError: message } });
    if (!result.count) throw new Error("Monitor summary connector not found");
    return { id: input.id, success: input.success };
  }
  if (input.kind === "INVITATION") {
    const result = await prisma.workspaceInvitation.updateMany({ where: { id: input.id, workspaceId }, data: input.success ? { emailStatus: "SENT", emailSentAt: now, emailLastError: null, emailClaimedAt: null } : { emailStatus: "FAILED", emailLastError: message, emailClaimedAt: null } });
    if (!result.count) throw new Error("Invitation delivery item not found");
    return { id: input.id, success: input.success };
  }
  const notification = await prisma.notification.findFirst({ where: { id: input.id, workspaceId }, select: { reminder: { select: { id: true } } } });
  if (!notification) throw new Error("Notification delivery item not found");
  return prisma.$transaction(async (tx) => {
    await tx.notification.update({ where: { id: input.id }, data: input.success ? { emailStatus: "SENT", emailSentAt: now, emailLastError: null, emailClaimedAt: null } : { emailStatus: "FAILED", emailLastError: message, emailClaimedAt: null } });
    if (notification?.reminder) await tx.reminder.update({ where: { id: notification.reminder.id }, data: input.success ? { status: "SENT", processedAt: now, lastError: null } : { status: "FAILED", lastError: message } });
    return { id: input.id, success: input.success };
  });
}

export async function prepareReminderForAppsScript(reminderId: string) {
  const reminder = await prisma.reminder.findUnique({ where: { id: reminderId }, select: { id: true, workspaceId: true } });
  if (!reminder) return null;
  await prepareReminderQueue(reminder.workspaceId, 1);
  return prisma.reminder.findUnique({ where: { id: reminderId } });
}

export async function prepareDueReminderEmailQueue(workspaceId: string, limit = 25) {
  return prepareReminderQueue(workspaceId, Math.max(1, Math.min(limit, 50)));
}
