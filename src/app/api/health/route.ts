import { prisma } from "@/lib/server/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok", service: "taskflow" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "degraded", service: "taskflow" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
