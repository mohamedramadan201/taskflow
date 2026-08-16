import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { EmailInboxClient } from "@/components/email-inbox-client";
import { hasPermission } from "@/lib/permissions";
import { assertPermission, listUserWorkspaces, requireWorkspaceBySlug } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";

export default async function EmailsPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const session = await auth(); if (!session?.user?.id || !session.user.email) redirect("/login"); const slug = (await searchParams).workspace || "taskflow-demo";
  const access = await requireWorkspaceBySlug(slug, { id: session.user.id, email: session.user.email }); assertPermission(access.subject, "EMAIL_VIEW");
  const canManage = hasPermission(access.subject, "EMAIL_CONNECTOR_MANAGE"); const canTriage = hasPermission(access.subject, "EMAIL_TRIAGE");
  const [emails, connectors, members, tasks, workspaces] = await Promise.all([
    prisma.inboundEmail.findMany({ where: { workspaceId: access.workspace.id }, include: { connector: { select: { id: true, mailboxAddress: true, displayName: true } }, task: { select: { id: true, title: true } }, handledBy: { select: { name: true, email: true } } }, orderBy: { receivedAt: "desc" }, take: 250 }),
    canManage ? prisma.emailConnector.findMany({ where: { workspaceId: access.workspace.id }, omit: { tokenHash: true }, include: { filters: { orderBy: { createdAt: "asc" } }, _count: { select: { emails: true } } }, orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
    prisma.workspaceMember.findMany({ where: { workspaceId: access.workspace.id, suspendedAt: null }, select: { role: true, user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.task.findMany({ where: { workspaceId: access.workspace.id }, select: { id: true, title: true, status: true }, orderBy: { updatedAt: "desc" }, take: 200 }), listUserWorkspaces(session.user.id),
  ]);
  return <AppShell active="emails" userName={session.user.name} workspaces={workspaces} workspaceSlug={slug}><EmailInboxClient initialEmails={emails} initialConnectors={connectors} members={members} tasks={tasks} workspaceId={access.workspace.id} workspaceSlug={slug} canManage={canManage} canTriage={canTriage} currentUserId={session.user.id} /></AppShell>;
}
