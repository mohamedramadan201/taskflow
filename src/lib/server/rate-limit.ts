import { prisma } from "@/lib/server/prisma";

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

export function requestClientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = request.headers.get("x-real-ip")?.trim() || forwarded || "unknown";
  return address.slice(0, 128);
}

export async function consumeRateLimit(key: string, max: number, windowMs = DEFAULT_WINDOW_MS, now = new Date()) {
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs);
  const rows = await prisma.$queryRaw<Array<{ count: number; expiresAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "windowStartedAt", "count", "expiresAt")
    VALUES (${key}, ${windowStart}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "windowStartedAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${windowStart} ELSE "RateLimitBucket"."windowStartedAt" END,
      "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "RateLimitBucket"."expiresAt" END
    RETURNING "count", "expiresAt"
  `;
  const row = rows[0];
  if (!row) throw new Error("Rate limiter did not return a bucket");
  return { allowed: row.count <= max, count: row.count, retryAfterSeconds: Math.max(1, Math.ceil((new Date(row.expiresAt).getTime() - now.getTime()) / 1000)) };
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return Response.json({ error: "Too many requests. Try again later." }, { status: 429, headers: { "retry-after": String(retryAfterSeconds), "cache-control": "no-store" } });
}
