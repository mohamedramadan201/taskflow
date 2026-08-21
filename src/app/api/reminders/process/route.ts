import { processDueReminders } from "@/lib/server/notification-service";
import { secureSecretMatches } from "@/lib/server/secure-compare";
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secureSecretMatches(token, process.env.CRON_SECRET)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await processDueReminders());
}
