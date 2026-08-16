import { HttpError, requireUser, errorResponse } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
export async function PATCH(_: Request, { params }: { params: Promise<{ notificationId: string }> }) { try {
  const user = await requireUser(); const { notificationId } = await params; const item = await prisma.notification.findUnique({ where: { id: notificationId } }); if (!item || item.userId !== user.id) throw new HttpError(404, "Notification not found");
  return Response.json(await prisma.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } }));
} catch (e) { return errorResponse(e); } }
