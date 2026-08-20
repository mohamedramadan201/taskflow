import { buildEmailDeliverySubject } from "../email-delivery";
import { prisma } from "./prisma";
import { sendNotificationEmail } from "./email-provider";

export async function deliverAssignmentNotification(notificationId: string) {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId }, include: { user: true, task: true, workspace: true } });
  if (!notification || notification.type !== "TASK_ASSIGNED" || !notification.task) return notification;
  if (!notification.user.emailNotifications) return prisma.notification.update({ where: { id: notificationId }, data: { emailStatus: "SKIPPED", emailLastError: "Disabled by notification preferences" } });
  try {
    await sendNotificationEmail({ to: notification.user.email, subject: notification.emailSubject || buildEmailDeliverySubject("TASK_ASSIGNED"), text: `${notification.message}\n\nWorkspace: ${notification.workspace.name}\nTask: ${notification.task.title}\n\nOpen TaskFlow to review the task.` });
    return prisma.notification.update({ where: { id: notificationId }, data: { emailStatus: "SENT", emailSentAt: new Date(), emailAttempts: { increment: 1 }, emailLastError: null } });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Delivery failed";
    return prisma.notification.update({ where: { id: notificationId }, data: { emailStatus: "FAILED", emailAttempts: { increment: 1 }, emailLastError: message } });
  }
}

export async function deliverReminder(reminderId: string) {
  const reminder = await prisma.reminder.findUnique({ where: { id: reminderId }, include: { task: true, user: true } });
  if (!reminder || reminder.status === "SENT" || reminder.status === "CANCELLED") return reminder;
  const claimed = await prisma.reminder.updateMany({
    where: { id: reminderId, status: { in: ["PENDING", "FAILED"] }, attempts: { lt: 3 } },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return reminder;
  if (!reminder.user.taskReminderNotifications) {
    await prisma.reminder.update({ where: { id: reminderId }, data: { status: "CANCELLED", processedAt: new Date(), lastError: "Disabled by notification preferences" } });
    return prisma.reminder.findUnique({ where: { id: reminderId } });
  }
  const subject = buildEmailDeliverySubject("TASK_REMINDER");
  const message = `Reminder: ${reminder.task.title}`;
  const notification = reminder.notificationId
    ? await prisma.notification.findUniqueOrThrow({ where: { id: reminder.notificationId } })
    : await prisma.notification.create({ data: { workspaceId: reminder.workspaceId, userId: reminder.userId, taskId: reminder.taskId, type: "TASK_REMINDER", message, emailTo: reminder.user.email, emailSubject: subject } });
  if (!reminder.notificationId) await prisma.reminder.update({ where: { id: reminderId }, data: { notificationId: notification.id } });
  if (!reminder.user.emailNotifications) {
    const now = new Date();
    await prisma.$transaction([
      prisma.notification.update({ where: { id: notification.id }, data: { emailStatus: "SKIPPED", emailLastError: "Disabled by notification preferences" } }),
      prisma.reminder.update({ where: { id: reminderId }, data: { status: "SENT", processedAt: now, lastError: null } }),
    ]);
    return prisma.reminder.findUnique({ where: { id: reminderId }, include: { notification: true } });
  }
  try {
    await sendNotificationEmail({ to: reminder.user.email, subject, text: `${message}\n\nOpen TaskFlow to review the task.` });
    const now = new Date();
    await prisma.$transaction([
      prisma.notification.update({ where: { id: notification.id }, data: { emailStatus: "SENT", emailSentAt: now, emailAttempts: { increment: 1 }, emailLastError: null } }),
      prisma.reminder.update({ where: { id: reminderId }, data: { status: "SENT", processedAt: now, lastError: null } }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Delivery failed";
    await prisma.$transaction([
      prisma.notification.update({ where: { id: notification.id }, data: { emailStatus: "FAILED", emailAttempts: { increment: 1 }, emailLastError: message } }),
      prisma.reminder.update({ where: { id: reminderId }, data: { status: "FAILED", lastError: message } }),
    ]);
    throw error;
  }
  return prisma.reminder.findUnique({ where: { id: reminderId }, include: { notification: true } });
}

export async function processDueReminders(limit = 25) {
  const due = await prisma.reminder.findMany({ where: { status: { in: ["PENDING", "FAILED"] }, scheduledAt: { lte: new Date() }, attempts: { lt: 3 } }, orderBy: { scheduledAt: "asc" }, take: limit });
  const results = await Promise.allSettled(due.map((item) => deliverReminder(item.id)));
  return { processed: due.length, sent: results.filter((r) => r.status === "fulfilled").length, failed: results.filter((r) => r.status === "rejected").length };
}

export async function claimReminderEmailJobs(limit = 25) {
  const due = await prisma.reminder.findMany({
    where: { status: { in: ["PENDING", "FAILED"] }, scheduledAt: { lte: new Date() }, attempts: { lt: 3 } },
    orderBy: { scheduledAt: "asc" }, take: limit,
    include: { task: true, user: true },
  });
  const jobs = [];
  for (const reminder of due) {
    const claimed = await prisma.reminder.updateMany({
      where: { id: reminder.id, status: { in: ["PENDING", "FAILED"] }, attempts: { lt: 3 } },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    if (!reminder.user.taskReminderNotifications || !reminder.user.emailNotifications) {
      await prisma.reminder.update({ where: { id: reminder.id }, data: { status: "CANCELLED", processedAt: new Date(), lastError: "Disabled by notification preferences" } });
      continue;
    }
    const subject = buildEmailDeliverySubject("TASK_REMINDER");
    const notification = reminder.notificationId
      ? await prisma.notification.findUniqueOrThrow({ where: { id: reminder.notificationId } })
      : await prisma.notification.create({ data: { workspaceId: reminder.workspaceId, userId: reminder.userId, taskId: reminder.taskId, type: "TASK_REMINDER", message: `Reminder: ${reminder.task.title}`, emailTo: reminder.user.email, emailSubject: subject } });
    if (!reminder.notificationId) await prisma.reminder.update({ where: { id: reminder.id }, data: { notificationId: notification.id } });
    jobs.push({ id: reminder.id, notificationId: notification.id, to: reminder.user.email, subject, text: `Reminder: ${reminder.task.title}\n\nOpen TaskFlow to review the task.` });
  }
  return jobs;
}

export async function completeReminderEmailJob(id: string, notificationId: string, success: boolean, error?: string) {
  const now = new Date();
  const message = (error || "Delivery failed").slice(0, 500);
  return prisma.$transaction([
    prisma.notification.update({ where: { id: notificationId }, data: { emailStatus: success ? "SENT" : "FAILED", emailSentAt: success ? now : undefined, emailAttempts: { increment: 1 }, emailLastError: success ? null : message } }),
    prisma.reminder.update({ where: { id }, data: { status: success ? "SENT" : "FAILED", processedAt: success ? now : null, lastError: success ? null : message } }),
  ]);
}
