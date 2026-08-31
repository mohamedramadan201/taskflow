import { HttpError } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";

const PRIVATE_MAILBOX = "mohamed.ramadan@al-dawaa.com.sa";

function teamMailboxKeywords(teamName?: string | null) {
  const name = (teamName || "").toLowerCase();
  if (name.includes("catalog")) return ["catalog"];
  if (name.includes("merch")) return ["merch", "merchandising"];
  return [];
}

async function memberContext(workspaceId: string, userId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true, suspendedAt: true, teamGroup: { select: { name: true } } },
  });
  if (!member || member.suspendedAt) throw new HttpError(403, "Workspace access denied");
  return { owner: member.role === "OWNER", keywords: teamMailboxKeywords(member.teamGroup?.name) };
}

function connectorTeamWhere(keywords: string[]) {
  return keywords.length ? { OR: keywords.flatMap((keyword) => [
    { mailboxAddress: { contains: keyword, mode: "insensitive" as const } },
    { displayName: { contains: keyword, mode: "insensitive" as const } },
  ]) } : { id: "__no_team_connector__" };
}

export async function emailVisibilityWhere(workspaceId: string, userId: string, userEmail: string) {
  const context = await memberContext(workspaceId, userId);
  if (context.owner) return { workspaceId };
  const isPrivateOwner = userEmail.toLowerCase() === PRIVATE_MAILBOX;
  return {
    workspaceId,
    connector: {
      OR: [
        ...(isPrivateOwner ? [{ mailboxAddress: { equals: PRIVATE_MAILBOX, mode: "insensitive" as const } }] : []),
        connectorTeamWhere(context.keywords),
      ],
    },
  };
}

export async function taskVisibilityWhere(workspaceId: string, userId: string, userEmail: string) {
  const context = await memberContext(workspaceId, userId);
  if (context.owner) return { workspaceId };
  const emailWhere = await emailVisibilityWhere(workspaceId, userId, userEmail);
  return {
    workspaceId,
    OR: [
      { assigneeUserId: userId },
      { createdByUserId: userId },
      { sourceEmails: { some: emailWhere } },
    ],
  };
}

export async function assertEmailVisible(emailId: string, workspaceId: string, userId: string, userEmail: string) {
  const where = await emailVisibilityWhere(workspaceId, userId, userEmail);
  const visible = await prisma.inboundEmail.findFirst({ where: { AND: [{ id: emailId }, where] }, select: { id: true } });
  if (!visible) throw new HttpError(403, "You do not have access to this email");
}

export async function assertTaskVisible(taskId: string, workspaceId: string, userId: string, userEmail: string) {
  const where = await taskVisibilityWhere(workspaceId, userId, userEmail);
  const visible = await prisma.task.findFirst({ where: { AND: [{ id: taskId }, where] }, select: { id: true } });
  if (!visible) throw new HttpError(404, "Task not found");
}
