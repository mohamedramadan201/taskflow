import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { TeamClient } from "@/components/team-client";
import { customRolePermissions, hasPermission } from "@/lib/permissions";
import { listUserWorkspaces, requireWorkspaceBySlug } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) redirect("/login");
  const slug = (await searchParams).workspace || "taskflow-demo";
  const { workspace, role, subject } = await requireWorkspaceBySlug(slug, { id: session.user.id, email: session.user.email });
  const [members, invitations, auditEvents, customRoles, workspaces] = await Promise.all([
    prisma.workspaceMember.findMany({ where: { workspaceId: workspace.id }, select: { role: true, suspendedAt: true, customRoleId: true, weeklyCapacityMinutes: true, availability: { where: { date: { gte: new Date(new Date().setUTCHours(0, 0, 0, 0)) } }, orderBy: { date: "asc" }, take: 8, select: { id: true, date: true, availableMinutes: true, note: true } }, customRole: { select: { name: true } }, user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    hasPermission(subject, "MEMBER_INVITE") ? prisma.workspaceInvitation.findMany({ where: { workspaceId: workspace.id, acceptedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, email: true, role: true, expiresAt: true }, orderBy: { createdAt: "desc" } }) : [],
    hasPermission(subject, "AUDIT_VIEW") ? prisma.activityEvent.findMany({ where: { workspaceId: workspace.id }, select: { id: true, type: true, detailsJson: true, createdAt: true, actor: { select: { name: true, email: true } }, task: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 30 }) : [],
    prisma.workspaceRoleDefinition.findMany({ where: { workspaceId: workspace.id }, select: { id: true, name: true, description: true, permissions: true, _count: { select: { members: true } } }, orderBy: { name: "asc" } }),
    listUserWorkspaces(session.user.id),
  ]);
  return <AppShell active="team" userName={session.user.name} workspaces={workspaces} workspaceSlug={slug}><TeamClient initialMembers={members} initialInvitations={invitations} initialAuditEvents={auditEvents} initialCustomRoles={customRoles} availablePermissions={customRolePermissions} role={role} currentUserId={session.user.id} workspaceId={workspace.id} /></AppShell>;
}
