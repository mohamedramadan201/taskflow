import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { BoardClient } from "@/components/board-client";
import { buildWorkspaceActionCenter } from "@/lib/reporting";
import { hasPermission } from "@/lib/permissions";
import { listUserWorkspaces, requireWorkspaceBySlug } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";

// Hard cap on how many tasks the board ever loads in one request. Without this the
// query and the client hydration payload both grow without bound as a workspace
// accumulates tasks. Most workspaces stay well under this; when a workspace exceeds
// it we tell the user so manager counts and filters are known to be partial rather
// than silently under-reporting.
const TASK_FETCH_LIMIT = 1000;

const taskSelect = { id: true, title: true, description: true, status: true, priority: true, dueAt: true, startedAt: true, completedAt: true, createdAt: true, updatedAt: true, estimatedMinutes: true, remainingMinutes: true, actualMinutes: true, blockedAt: true, blockedReason: true, blockerTaskId: true, recurrence: true, recurrenceInterval: true, updatedProductsCount: true, newProductsCount: true, updatedImagesCount: true, newImagesCount: true, createdByUserId: true, assigneeUserId: true, followUpWith: true, assignee: { select: { id: true, name: true, email: true } }, labelAssignments: { select: { label: true } } } as const;

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) redirect("/login");
  const slug = (await searchParams).workspace || "taskflow-demo";
  const { workspace, role, subject } = await requireWorkspaceBySlug(slug, { id: session.user.id, email: session.user.email });
  const [tasks, totalTaskCount, members, workspaces, labels, savedViews] = await Promise.all([
    prisma.task.findMany({ where: { workspaceId: workspace.id }, select: taskSelect, orderBy: { createdAt: "desc" }, take: TASK_FETCH_LIMIT }),
    prisma.task.count({ where: { workspaceId: workspace.id } }),
    prisma.workspaceMember.findMany({ where: { workspaceId: workspace.id, suspendedAt: null }, include: { user: { select: { id: true, name: true, email: true } }, teamGroup: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } }),
    listUserWorkspaces(session.user.id),
    prisma.taskLabel.findMany({ where: { workspaceId: workspace.id }, orderBy: { name: "asc" } }),
    prisma.savedTaskView.findMany({ where: { workspaceId: workspace.id, OR: [{ userId: session.user.id }, { shared: true }] }, orderBy: [{ shared: "desc" }, { name: "asc" }] }),
  ]);
  const normalizedTasks = tasks.map(({ labelAssignments, ...task }) => ({ ...task, labels: labelAssignments.map(({ label }) => label) }));
  const actionCenter = buildWorkspaceActionCenter(normalizedTasks, members, new Date(), workspace.overloadThreshold);
  return (
    <AppShell active="board" userName={session.user.name} workspaces={workspaces} workspaceSlug={slug}>
      <BoardClient
        key={workspace.id}
        initialTasks={normalizedTasks}
        totalTaskCount={totalTaskCount}
        members={members}
        role={role}
        canManageWorkspace={hasPermission(subject, "WORKSPACE_MANAGE")}
        managerActionCenter={actionCenter}
        workspaceId={workspace.id}
        currentUserId={session.user.id}
        initialLabels={labels}
        initialSavedViews={savedViews}
      />
    </AppShell>
  );
}
