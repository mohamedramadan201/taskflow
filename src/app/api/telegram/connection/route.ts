import { createTelegramLinkToken, telegramIsConfigured, telegramLinkUrl } from "@/lib/server/telegram";
import { requireUser, errorResponse } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    const connection = await prisma.telegramConnection.findUnique({ where: { userId: user.id }, select: { id: true, username: true, firstName: true, linkedAt: true, lastSeenAt: true, enabled: true } });
    return Response.json({ configured: telegramIsConfigured(), connection });
  } catch (error) { return errorResponse(error); }
}

export async function POST() {
  try {
    const user = await requireUser();
    if (!telegramIsConfigured()) return Response.json({ error: "Telegram integration is not configured yet." }, { status: 503 });
    const token = createTelegramLinkToken();
    await prisma.telegramLinkToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await prisma.telegramLinkToken.create({ data: { userId: user.id, tokenHash: token.hash, expiresAt: token.expiresAt } });
    return Response.json({ linkUrl: telegramLinkUrl(token.raw), expiresAt: token.expiresAt });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    await prisma.telegramConnection.deleteMany({ where: { userId: user.id } });
    await prisma.telegramLinkToken.deleteMany({ where: { userId: user.id } });
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
