ALTER TABLE "Task" ADD COLUMN "completedAt" TIMESTAMP(3);

UPDATE "Task"
SET "completedAt" = "updatedAt"
WHERE "status" = 'DONE' AND "completedAt" IS NULL;

CREATE TABLE "TaskLabel" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#176b50',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskLabel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskLabelAssignment" (
  "taskId" TEXT NOT NULL,
  "labelId" TEXT NOT NULL,
  CONSTRAINT "TaskLabelAssignment_pkey" PRIMARY KEY ("taskId", "labelId")
);

CREATE TABLE "SavedTaskView" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "shared" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedTaskView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Task_workspaceId_completedAt_idx" ON "Task"("workspaceId", "completedAt");
CREATE INDEX "Task_workspaceId_dueAt_idx" ON "Task"("workspaceId", "dueAt");
CREATE INDEX "TaskLabel_workspaceId_createdAt_idx" ON "TaskLabel"("workspaceId", "createdAt");
CREATE UNIQUE INDEX "TaskLabel_workspaceId_name_key" ON "TaskLabel"("workspaceId", "name");
CREATE INDEX "TaskLabelAssignment_labelId_taskId_idx" ON "TaskLabelAssignment"("labelId", "taskId");
CREATE INDEX "SavedTaskView_workspaceId_shared_name_idx" ON "SavedTaskView"("workspaceId", "shared", "name");
CREATE INDEX "SavedTaskView_userId_workspaceId_idx" ON "SavedTaskView"("userId", "workspaceId");
CREATE UNIQUE INDEX "SavedTaskView_workspaceId_userId_name_key" ON "SavedTaskView"("workspaceId", "userId", "name");

ALTER TABLE "TaskLabel" ADD CONSTRAINT "TaskLabel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskLabelAssignment" ADD CONSTRAINT "TaskLabelAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskLabelAssignment" ADD CONSTRAINT "TaskLabelAssignment_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "TaskLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedTaskView" ADD CONSTRAINT "SavedTaskView_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedTaskView" ADD CONSTRAINT "SavedTaskView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskLabel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskLabelAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedTaskView" ENABLE ROW LEVEL SECURITY;
