import { assertPermission, errorResponse, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { parseJson, workspaceReminderSettingsSchema } from "@/lib/validation";

async function defaultSettings(workspaceId: string) {
  const members = await prisma.workspaceMember.findMany({ where: { workspaceId, suspendedAt: null }, select: { user: { select: { email: true } } }, orderBy: { createdAt: "asc" } });
  return { defaultAssignedEmails: [], assigneeDirectoryEmails: members.map((member) => member.user.email.toLowerCase()), defaultCalendarPopupMinutes: 10, defaultEmailIntro: "Hello,\n\nThis is a reminder for the following task:", defaultEmailSignature: "Regards,\nTaskFlow", sendCopyToCreator: false, archiveAfterDays: 90 };
}

export async function GET(_: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    await requireMembership(workspaceId);
    const existing = await prisma.workspaceReminderSettings.findUnique({ where: { workspaceId } });
    return Response.json(existing || await defaultSettings(workspaceId));
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    const access = await requireMembership(workspaceId);
    assertPermission(access.subject, "WORKSPACE_MANAGE", "Reminder settings require workspace management access");
    const input = await parseJson(request, workspaceReminderSettingsSchema);
    const settings = await prisma.workspaceReminderSettings.upsert({ where: { workspaceId }, create: { workspaceId, ...input }, update: input });
    return Response.json(settings);
  } catch (error) { return errorResponse(error); }
}
