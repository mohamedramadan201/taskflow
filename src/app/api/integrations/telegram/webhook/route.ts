import { processTelegramUpdate, telegramIsConfigured, telegramWebhookIsAuthorized } from "@/lib/server/telegram";

export async function POST(request: Request) {
  if (!telegramIsConfigured() || !telegramWebhookIsAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await processTelegramUpdate(await request.json());
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[TaskFlow Telegram] Webhook processing failed", error);
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

export function GET() { return Response.json({ ok: true, configured: telegramIsConfigured() }); }
