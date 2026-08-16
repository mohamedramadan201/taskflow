CREATE INDEX "Task_workspaceId_createdAt_idx" ON "Task"("workspaceId", "createdAt");
CREATE INDEX "Comment_workspaceId_idx" ON "Comment"("workspaceId");
CREATE INDEX "WorkspaceInvitation_invitedByUserId_idx" ON "WorkspaceInvitation"("invitedByUserId");
CREATE INDEX "WorkspaceInvitation_acceptedByUserId_idx" ON "WorkspaceInvitation"("acceptedByUserId");
