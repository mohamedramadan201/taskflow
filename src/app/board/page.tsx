import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { BoardClient } from "@/components/board-client";
import { buildWorkspaceActionCenter } from "@/lib/reporting";
import { hasPermission } from "@/lib/permissions";
import { listUserWorkspaces, requireWorkspaceBySlug } from "@/lib/server/authorization";
import { taskVisibilityWhere } from "@/lib/server/record-access";
import { prisma } from "@/lib/server/prisma";
const BOARD_PAGE_SIZE = 100;

const boardTaskSelect = { id: true, title: true, description: true, status: true, priority: true, dueAt: true, startedAt: true, completedAt: true, createdAt: true, updatedAt: true, estimatedMinutes: true, remainingMinutes: true, actualMinutes: true, blockedAt: true, blockedReason: true, blockerTaskId: true, recurrence: true, recurrenceInterval: true, updatedProductsCount: true, newProductsCount: true, updatedImagesCount: true, newImagesCount: true, createdByUserId: true, assigneeUserId: true, followUpWith: true, assignee: { select: { id: true, name: true, email: true } }, labelAssignments: { select: { label: true } } } as const;

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) redirect("/login");
  const userWorkspaces = await listUserWorkspaces(session.user.id);
  const slug = (await searchParams).workspace || userWorkspaces[0]?.slug;
  if (!slug) redirect("/login?error=no-workspace");
  const { workspace, role, subject } = await requireWorkspaceBySlug(slug, { id: session.user.id, email: session.user.email });
  const visibleTasks = await taskVisibilityWhere(workspace.id, session.user.id, session.user.email);
  const [taskPage, members, labels, savedViews] = await Promise.all([
    prisma.task.findMany({ where: visibleTasks, select: boardTaskSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: BOARD_PAGE_SIZE + 1 }),
    prisma.workspaceMember.findMany({ where: { workspaceId: workspace.id, suspendedAt: null }, include: { user: { select: { id: true, name: true, email: true } }, teamGroup: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.taskLabel.findMany({ where: { workspaceId: workspace.id }, orderBy: { name: "asc" } }),
    prisma.savedTaskView.findMany({ where: { workspaceId: workspace.id, OR: [{ userId: session.user.id }, { shared: true }] }, orderBy: [{ shared: "desc" }, { name: "asc" }] }),
  ]);
  const page = taskPage.slice(0, BOARD_PAGE_SIZE);
  const last = page.at(-1);
  const normalizedTasks = page.map(({ labelAssignments, ...task }) => ({ ...task, labels: labelAssignments.map(({ label }) => label) }));
  const actionCenter = buildWorkspaceActionCenter(normalizedTasks, members, new Date(), workspace.overloadThreshold);
  const workspaces = userWorkspaces;
  return <AppShell active="board" userName={session.user.name} workspaces={workspaces} workspaceSlug={slug}><BoardClient key={workspace.id} initialTasks={normalizedTasks} initialHasMore={taskPage.length > BOARD_PAGE_SIZE} initialNextCursor={taskPage.length > BOARD_PAGE_SIZE && last ? { createdAt: last.createdAt, id: last.id } : null} members={members} role={role} canManageWorkspace={hasPermission(subject, "WORKSPACE_MANAGE")} managerActionCenter={actionCenter} workspaceId={workspace.id} currentUserId={session.user.id} initialLabels={labels} initialSavedViews={savedViews} /></AppShell>;
}
