ALTER TABLE "Task" ADD COLUMN "followUpWith" TEXT;

CREATE INDEX "Task_workspaceId_followUpWith_idx" ON "Task"("workspaceId", "followUpWith");
