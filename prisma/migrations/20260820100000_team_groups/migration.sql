CREATE TABLE "TeamGroup" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamGroup_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkspaceMember" ADD COLUMN "teamGroupId" TEXT;

CREATE UNIQUE INDEX "TeamGroup_workspaceId_name_key" ON "TeamGroup"("workspaceId", "name");
CREATE INDEX "TeamGroup_workspaceId_createdAt_idx" ON "TeamGroup"("workspaceId", "createdAt");
CREATE INDEX "WorkspaceMember_teamGroupId_idx" ON "WorkspaceMember"("teamGroupId");

ALTER TABLE "TeamGroup" ADD CONSTRAINT "TeamGroup_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_teamGroupId_fkey" FOREIGN KEY ("teamGroupId") REFERENCES "TeamGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TeamGroup" ENABLE ROW LEVEL SECURITY;
