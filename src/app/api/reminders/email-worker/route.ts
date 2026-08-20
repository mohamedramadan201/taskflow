import { claimReminderEmailJobs, completeReminderEmailJob } from "@/lib/server/notification-service";

function authorized(request: Request) {
  const token = request.headers.get("x-taskflow-delivery-token");
  return Boolean(process.env.GOOGLE_APPS_SCRIPT_DELIVERY_SECRET && token === process.env.GOOGLE_APPS_SCRIPT_DELIVERY_SECRET);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const jobs = await claimReminderEmailJobs(Math.min(Number(new URL(request.url).searchParams.get("limit")) || 25, 50));
  return Response.json({ jobs }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.results) || body.results.length > 50) return Response.json({ error: "Invalid results" }, { status: 400 });
  for (const result of body.results) {
    if (typeof result?.id !== "string" || typeof result?.notificationId !== "string" || typeof result?.success !== "boolean") return Response.json({ error: "Invalid result item" }, { status: 400 });
    await completeReminderEmailJob(result.id, result.notificationId, result.success, typeof result.error === "string" ? result.error : undefined);
  }
  return Response.json({ updated: body.results.length });
}
