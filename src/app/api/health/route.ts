import { prisma } from "@/lib/server/prisma";
export async function GET() { try { await prisma.$queryRaw`SELECT 1`; return Response.json({ status: "ok" }); } catch { return Response.json({ status: "degraded" }, { status: 503 }); } }
