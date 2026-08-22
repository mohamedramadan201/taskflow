import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { ReminderClient } from "@/components/reminder-client";
import { hasPermission } from "@/lib/permissions";
import { listUserWorkspaces, requireWorkspaceBySlug } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";

export default async function RemindersPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) redirect("/login");
  const workspaces = await listUserWorkspaces(session.user.id);
  const slug = (await searchParams).workspace || workspaces[0]?.slug;
  if (!slug) redirect("/login?error=no-workspace");
  const { workspace, subject } = await requireWorkspaceBySlug(slug, { id: session.user.id, email: session.user.email });
  const [reminders, settings, members, logs] = await Promise.all([
    prisma.workspaceReminder.findMany({ where: { workspaceId: workspace.id, archivedAt: null }, include: { createdBy: { select: { id: true, name: true, email: true } } }, orderBy: [{ status: "asc" }, { reminderAt: "asc" }], take: 500 }),
    prisma.workspaceReminderSettings.findUnique({ where: { workspaceId: workspace.id } }),
    prisma.workspaceMember.findMany({ where: { workspaceId: workspace.id, suspendedAt: null }, select: { user: { select: { email: true, name: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.workspaceReminderLog.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const directory = settings?.assigneeDirectoryEmails.length ? settings.assigneeDirectoryEmails : members.map((member) => member.user.email);
  return <AppShell active="reminders" userName={session.user.name} workspaces={workspaces} workspaceSlug={slug}><ReminderClient initialReminders={reminders} initialSettings={settings} assigneeDirectory={directory} initialLogs={logs} workspaceId={workspace.id} workspaceSlug={slug} currentUserEmail={session.user.email} canManage={hasPermission(subject, "WORKSPACE_MANAGE")} /></AppShell>;
}
