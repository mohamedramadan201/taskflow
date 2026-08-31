import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { EmailInboxClient } from "@/components/email-inbox-client";
import { hasPermission } from "@/lib/permissions";
import { assertPermission, listUserWorkspaces, requireWorkspaceBySlug } from "@/lib/server/authorization";
import { emailVisibilityWhere, taskVisibilityWhere } from "@/lib/server/record-access";
import { prisma } from "@/lib/server/prisma";

export default async function EmailsPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const session = await auth(); if (!session?.user?.id || !session.user.email) redirect("/login"); const userWorkspaces = await listUserWorkspaces(session.user.id); const slug = (await searchParams).workspace || userWorkspaces[0]?.slug; if (!slug) redirect("/login?error=no-workspace");
  const access = await requireWorkspaceBySlug(slug, { id: session.user.id, email: session.user.email }); assertPermission(access.subject, "EMAIL_VIEW");
  const canManage = access.role === "OWNER"; const canTriage = hasPermission(access.subject, "EMAIL_TRIAGE");
  const visibleEmails = await emailVisibilityWhere(access.workspace.id, session.user.id, session.user.email);
  const visibleTasks = await taskVisibilityWhere(access.workspace.id, session.user.id, session.user.email);
  const [emails, connectors, members, tasks, monitorThreads, linkedThreadTasks, statusCounts] = await Promise.all([
    prisma.inboundEmail.findMany({ where: visibleEmails, include: { connector: { select: { id: true, mailboxAddress: true, displayName: true, monitorEnabled: true } }, task: { select: { id: true, title: true, status: true } }, handledBy: { select: { name: true, email: true } } }, orderBy: { receivedAt: "desc" }, take: 250 }),
    canManage ? prisma.emailConnector.findMany({ where: { workspaceId: access.workspace.id }, omit: { tokenHash: true }, include: { filters: { orderBy: { createdAt: "asc" } }, _count: { select: { emails: true } } }, orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
    prisma.workspaceMember.findMany({ where: { workspaceId: access.workspace.id, suspendedAt: null }, select: { role: true, user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.task.findMany({ where: visibleTasks, select: { id: true, title: true, status: true }, orderBy: { updatedAt: "desc" }, take: 200 }),
    prisma.emailMonitorThread.findMany({ where: { workspaceId: access.workspace.id, connector: { emails: { some: visibleEmails } } }, select: { connectorId: true, gmailThreadId: true, status: true, latestRelevantSenderAddress: true, latestRelevantMessageAt: true, latestExternalMessageAt: true, slaDueAt: true, priority: true, agingBucket: true } }),
    prisma.inboundEmail.findMany({ where: { ...visibleEmails, taskId: { not: null } }, select: { connectorId: true, gmailThreadId: true, taskId: true, task: { select: { id: true, title: true, status: true } } } }),
    prisma.inboundEmail.groupBy({ where: visibleEmails, by: ["status"], _count: { _all: true } }),
  ]);
  const initialCounts = { UNTRIAGED: 0, CONVERTED: 0, NO_ACTION_NEEDED: 0, DISMISSED: 0 };
  for (const item of statusCounts) initialCounts[item.status] = item._count._all;
  const taskByThread = new Map<string, { id: string; title: string; status: string }>();
  linkedThreadTasks.forEach((item) => { if (item.task && "id" in item.task && "title" in item.task) taskByThread.set(`${item.connectorId}:${item.gmailThreadId}`, { id: item.task.id, title: item.task.title, status: String(item.task.status) }); });
  const monitorByThread = new Map(monitorThreads.map((item) => [`${item.connectorId}:${item.gmailThreadId}`, item]));
  const emailsWithMonitor = emails.map((email) => ({ ...email, monitor: monitorByThread.get(`${email.connectorId}:${email.gmailThreadId}`) || null, task: email.task ? { id: email.task.id, title: email.task.title, status: String(email.task.status) } : taskByThread.get(`${email.connectorId}:${email.gmailThreadId}`) || null }));
  const workspaces = userWorkspaces;
  return <AppShell active="emails" userName={session.user.name} workspaces={workspaces} workspaceSlug={slug}><EmailInboxClient initialEmails={emailsWithMonitor} initialCounts={initialCounts} initialConnectors={connectors} members={members} tasks={tasks} workspaceId={access.workspace.id} workspaceSlug={slug} canManage={canManage} canTriage={canTriage} currentUserId={session.user.id} /></AppShell>;
}
