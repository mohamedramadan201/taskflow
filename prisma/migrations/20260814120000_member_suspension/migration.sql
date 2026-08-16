ALTER TABLE "WorkspaceMember"
ADD COLUMN "suspendedAt" TIMESTAMP(3),
ADD COLUMN "suspendedByUserId" TEXT;

CREATE INDEX "WorkspaceMember_workspaceId_suspendedAt_idx"
ON "WorkspaceMember"("workspaceId", "suspendedAt");
