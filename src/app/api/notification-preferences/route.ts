import { errorResponse, requireUser } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { notificationPreferenceSchema, parseJson } from "@/lib/validation";

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json(await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { emailNotifications: true, taskReminderNotifications: true } }));
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, notificationPreferenceSchema);
    return Response.json(await prisma.user.update({ where: { id: user.id }, data: input, select: { emailNotifications: true, taskReminderNotifications: true } }));
  } catch (error) { return error instanceof Response ? error : errorResponse(error); }
}
