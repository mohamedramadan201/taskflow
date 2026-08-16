ALTER TABLE "Workspace"
  ADD COLUMN "overloadThreshold" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "dueSoonDays" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "stalledAfterDays" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "WorkspaceMember"
  ADD COLUMN "weeklyCapacityMinutes" INTEGER NOT NULL DEFAULT 1800;

ALTER TABLE "Task"
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "estimatedMinutes" INTEGER,
  ADD COLUMN "remainingMinutes" INTEGER,
  ADD COLUMN "actualMinutes" INTEGER,
  ADD COLUMN "blockedAt" TIMESTAMP(3),
  ADD COLUMN "blockedReason" TEXT,
  ADD COLUMN "blockerTaskId" TEXT;

UPDATE "Task" SET "startedAt" = "updatedAt"
WHERE "status" IN ('IN_PROGRESS', 'DONE') AND "startedAt" IS NULL;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_estimatedMinutes_nonnegative" CHECK ("estimatedMinutes" IS NULL OR "estimatedMinutes" >= 0),
  ADD CONSTRAINT "Task_remainingMinutes_nonnegative" CHECK ("remainingMinutes" IS NULL OR "remainingMinutes" >= 0),
  ADD CONSTRAINT "Task_actualMinutes_nonnegative" CHECK ("actualMinutes" IS NULL OR "actualMinutes" >= 0),
  ADD CONSTRAINT "Task_blockerTaskId_fkey" FOREIGN KEY ("blockerTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Task_not_own_blocker" CHECK ("blockerTaskId" IS NULL OR "blockerTaskId" <> "id");

ALTER TABLE "WorkspaceMember"
  ADD CONSTRAINT "WorkspaceMember_capacity_range" CHECK ("weeklyCapacityMinutes" BETWEEN 0 AND 10080);

ALTER TABLE "Workspace"
  ADD CONSTRAINT "Workspace_overload_threshold_range" CHECK ("overloadThreshold" BETWEEN 50 AND 200),
  ADD CONSTRAINT "Workspace_due_soon_days_range" CHECK ("dueSoonDays" BETWEEN 1 AND 30),
  ADD CONSTRAINT "Workspace_stalled_days_range" CHECK ("stalledAfterDays" BETWEEN 1 AND 90);

CREATE TABLE "MemberAvailability" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "workspaceMemberId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "availableMinutes" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemberAvailability_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MemberAvailability_minutes_range" CHECK ("availableMinutes" BETWEEN 0 AND 1440),
  CONSTRAINT "MemberAvailability_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MemberAvailability_workspaceMemberId_fkey" FOREIGN KEY ("workspaceMemberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MemberAvailability_workspaceMemberId_date_key" ON "MemberAvailability"("workspaceMemberId", "date");
CREATE INDEX "MemberAvailability_workspaceId_date_idx" ON "MemberAvailability"("workspaceId", "date");
CREATE INDEX "Task_workspaceId_assigneeUserId_status_dueAt_idx" ON "Task"("workspaceId", "assigneeUserId", "status", "dueAt");
CREATE INDEX "Task_workspaceId_blockedAt_idx" ON "Task"("workspaceId", "blockedAt");
CREATE INDEX "Task_blockerTaskId_idx" ON "Task"("blockerTaskId");

ALTER TABLE "MemberAvailability" ENABLE ROW LEVEL SECURITY;
