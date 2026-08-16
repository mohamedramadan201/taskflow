import { requireUser, errorResponse } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
export async function POST() { try { const user = await requireUser(); const result = await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } }); return Response.json(result); } catch (e) { return errorResponse(e); } }
