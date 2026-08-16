DROP INDEX IF EXISTS "ActivityEvent_taskId_idx";

CREATE INDEX "WorkspaceMember_workspaceId_createdAt_idx"
ON "WorkspaceMember"("workspaceId", "createdAt");

CREATE INDEX "ActivityEvent_taskId_createdAt_idx"
ON "ActivityEvent"("taskId", "createdAt");

CREATE INDEX "WorkspaceInvitation_workspaceId_acceptedAt_createdAt_idx"
ON "WorkspaceInvitation"("workspaceId", "acceptedAt", "createdAt");

CREATE INDEX "Notification_userId_createdAt_idx"
ON "Notification"("userId", "createdAt");
