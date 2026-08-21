import { createHash, randomBytes } from "node:crypto";
import { hasPermission, type AuthorizationSubject, type Permission, type Role } from "@/lib/permissions";
import { prisma } from "@/lib/server/prisma";
import { parseTelegramCommand } from "@/lib/telegram-command";

const TELEGRAM_API = "https://api.telegram.org";
const LINK_TOKEN_TTL_MS = 15 * 60 * 1000;

type TelegramReplyMarkup = { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };
type TelegramUpdate = { update_id?: number; message?: TelegramMessage; callback_query?: TelegramCallbackQuery };
type TelegramMessage = { message_id: number; text?: string; chat: { id: number; type: string }; from?: TelegramUser };
type TelegramCallbackQuery = { id: string; data?: string; from: TelegramUser; message?: TelegramMessage };
type TelegramUser = { id: number; username?: string; first_name?: string };

export function telegramIsConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME && process.env.TELEGRAM_WEBHOOK_SECRET);
}

export function telegramWebhookIsAuthorized(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  return Boolean(expected && request.headers.get("x-telegram-bot-api-secret-token") === expected);
}

export function createTelegramLinkToken() {
  const raw = randomBytes(24).toString("base64url");
  return { raw, hash: createHash("sha256").update(raw).digest("hex"), expiresAt: new Date(Date.now() + LINK_TOKEN_TTL_MS) };
}

export function telegramLinkUrl(token: string) {
  const username = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  return username ? `https://t.me/${username}?start=${token}` : null;
}

async function telegramApi<T>(method: string, body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Telegram bot is not configured");
  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const result = await response.json() as { ok: boolean; result?: T; description?: string };
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram ${method} failed`);
  return result.result as T;
}

export function sendTelegramMessage(chatId: string, text: string, replyMarkup?: TelegramReplyMarkup) {
  return telegramApi("sendMessage", { chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) });
}

function workspaceSubject(membership: { role: string; suspendedAt: Date | null; customRole: { permissions: unknown } | null }): AuthorizationSubject {
  const customPermissions = Array.isArray(membership.customRole?.permissions) ? membership.customRole?.permissions.filter((item): item is Permission => typeof item === "string") : null;
  return { role: membership.role as Role, permissions: customPermissions, suspendedAt: membership.suspendedAt };
}

async function findTelegramConnection(telegramUserId: string) {
  return prisma.telegramConnection.findUnique({ where: { telegramUserId } });
}

async function sendHelp(chatId: string) {
  await sendTelegramMessage(chatId, [
    "TaskFlow Telegram commands:",
    "/task <title> — create a task",
    "/note <title> — create a task from a quick note",
    "/spaces — choose the active space",
    "/space <name> — set the active space",
    "/mytasks — show your current space",
    "/disconnect — unlink this Telegram chat",
  ].join("\n"));
}

async function sendWorkspacePicker(chatId: string, userId: string) {
  const memberships = await prisma.workspaceMember.findMany({ where: { userId, suspendedAt: null }, select: { workspace: { select: { id: true, name: true } } }, orderBy: { workspace: { name: "asc" } }, take: 40 });
  if (!memberships.length) return sendTelegramMessage(chatId, "You do not have an active TaskFlow space yet.");
  return sendTelegramMessage(chatId, "Choose the TaskFlow space for new tasks:", { inline_keyboard: memberships.map(({ workspace }) => [{ text: workspace.name, callback_data: `space:${workspace.id}` }]) });
}

async function setDefaultWorkspace(connectionId: string, userId: string, workspaceId: string) {
  const membership = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } }, include: { workspace: { select: { id: true, name: true } } } });
  if (!membership || membership.suspendedAt) return null;
  return prisma.telegramConnection.update({ where: { id: connectionId }, data: { defaultWorkspaceId: workspaceId } }).then(() => membership.workspace);
}

async function createTelegramTask(connection: { id: string; userId: string; defaultWorkspaceId: string | null }, title: string) {
  if (!connection.defaultWorkspaceId) return { error: "Choose a space first with /spaces." } as const;
  const membership = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: connection.defaultWorkspaceId, userId: connection.userId } }, include: { customRole: { select: { permissions: true } }, workspace: { select: { name: true, slug: true } } } });
  if (!membership || membership.suspendedAt) return { error: "You no longer have access to the selected space." } as const;
  if (!hasPermission(workspaceSubject(membership), "TASK_CREATE")) return { error: "You do not have permission to create tasks in this space." } as const;
  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({ data: { workspaceId: connection.defaultWorkspaceId!, title, status: "TODO", priority: "MEDIUM", createdByUserId: connection.userId } });
    await tx.activityEvent.create({ data: { workspaceId: connection.defaultWorkspaceId!, taskId: created.id, actorUserId: connection.userId, type: "TASK_CREATED_FROM_TELEGRAM", detailsJson: { title, connectionId: connection.id } } });
    return created;
  });
  return { task, workspace: membership.workspace } as const;
}

async function linkTelegramUser(rawToken: string, user: TelegramUser, chatId: string) {
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const token = await prisma.telegramLinkToken.findFirst({ where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } } });
  if (!token) return { error: "This TaskFlow connection link is invalid or expired. Generate a new one in TaskFlow." } as const;
  const existing = await findTelegramConnection(String(user.id));
  if (existing && existing.userId !== token.userId) return { error: "This Telegram account is already linked to another TaskFlow account." } as const;
  const connection = await prisma.$transaction(async (tx) => {
    const linked = await tx.telegramConnection.upsert({ where: { userId: token.userId }, update: { telegramUserId: String(user.id), chatId, username: user.username || null, firstName: user.first_name || null, enabled: true, lastSeenAt: new Date() }, create: { userId: token.userId, telegramUserId: String(user.id), chatId, username: user.username || null, firstName: user.first_name || null } });
    await tx.telegramLinkToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
    return linked;
  });
  return { connection } as const;
}

async function handleCallbackQuery(callback: TelegramCallbackQuery) {
  const connection = await findTelegramConnection(String(callback.from.id));
  if (!connection || !callback.message) return;
  await telegramApi("answerCallbackQuery", { callback_query_id: callback.id });
  if (!callback.data?.startsWith("space:")) return;
  const workspace = await setDefaultWorkspace(connection.id, connection.userId, callback.data.slice("space:".length));
  await sendTelegramMessage(connection.chatId, workspace ? `Active space set to ${workspace.name}. Send /task <title> to create a task.` : "That space is not available to your TaskFlow account.");
}

async function handleMessage(message: TelegramMessage) {
  if (!message.from || message.chat.type !== "private") return;
  const chatId = String(message.chat.id);
  const telegramUserId = String(message.from.id);
  const text = message.text?.trim() || "";
  const parsed = parseTelegramCommand(text);
  if (parsed?.command === "start" && parsed.argument) {
    const result = await linkTelegramUser(parsed.argument, message.from, chatId);
    if ("error" in result) return sendTelegramMessage(chatId, result.error || "Telegram connection failed.");
    await sendTelegramMessage(chatId, `Connected to TaskFlow${result.connection.firstName ? `, ${result.connection.firstName}` : ""}.`);
    return sendWorkspacePicker(chatId, result.connection.userId);
  }
  const connection = await findTelegramConnection(telegramUserId);
  if (!connection || !connection.enabled) return sendTelegramMessage(chatId, "Connect this chat from TaskFlow first, then press Start in the TaskFlow bot.");
  await prisma.telegramConnection.update({ where: { id: connection.id }, data: { chatId, lastSeenAt: new Date() } });
  if (!parsed) return sendTelegramMessage(chatId, "Use /task <title> or /note <title> to create a TaskFlow task. Use /help for all commands.");
  if (parsed.command === "help") return sendHelp(chatId);
  if (parsed.command === "disconnect") { await prisma.telegramConnection.delete({ where: { id: connection.id } }); return sendTelegramMessage(chatId, "Telegram has been disconnected from TaskFlow."); }
  if (parsed.command === "spaces") return sendWorkspacePicker(chatId, connection.userId);
  if (parsed.command === "space") {
    const argument = parsed.argument;
    if (!argument) return sendWorkspacePicker(chatId, connection.userId);
    const memberships = await prisma.workspaceMember.findMany({ where: { userId: connection.userId, suspendedAt: null }, select: { workspace: { select: { id: true, name: true, slug: true } } } });
    const match = memberships.find(({ workspace }) => workspace.name.toLowerCase() === argument.toLowerCase() || workspace.slug.toLowerCase() === argument.toLowerCase());
    const workspace = match ? await setDefaultWorkspace(connection.id, connection.userId, match.workspace.id) : null;
    return sendTelegramMessage(chatId, workspace ? `Active space set to ${workspace.name}.` : "I could not find that space. Use /spaces to choose one.");
  }
  if (parsed.command === "mytasks") return sendTelegramMessage(chatId, "Open TaskFlow to review your current tasks. Task list summaries will be added in the next Telegram iteration.");
  if (parsed.command !== "task" && parsed.command !== "note") return sendHelp(chatId);
  const title = parsed.argument;
  if (!title) return sendTelegramMessage(chatId, `Usage: /${parsed.command} <task title>`);
  const result = await createTelegramTask(connection, title);
  if ("error" in result) return sendTelegramMessage(chatId, result.error || "Task creation failed.");
  return sendTelegramMessage(chatId, `Task created in ${result.workspace.name}: ${result.task.title}`);
}

export async function processTelegramUpdate(update: TelegramUpdate) {
  if (update.update_id !== undefined) {
    const existing = await prisma.telegramUpdate.findUnique({ where: { updateId: String(update.update_id) } });
    if (existing) return;
    const inserted = await prisma.telegramUpdate.create({ data: { updateId: String(update.update_id) } }).catch((error: unknown) => {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") return null;
      throw error;
    });
    if (!inserted) return;
  }
  if (update.callback_query) return handleCallbackQuery(update.callback_query);
  if (update.message) return handleMessage(update.message);
}
