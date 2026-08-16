CREATE TABLE "WorkspaceRoleDefinition" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "permissions" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceRoleDefinition_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkspaceMember" ADD COLUMN "customRoleId" TEXT;

CREATE UNIQUE INDEX "WorkspaceRoleDefinition_workspaceId_name_key" ON "WorkspaceRoleDefinition"("workspaceId", "name");
CREATE INDEX "WorkspaceRoleDefinition_workspaceId_createdAt_idx" ON "WorkspaceRoleDefinition"("workspaceId", "createdAt");
CREATE INDEX "WorkspaceMember_customRoleId_idx" ON "WorkspaceMember"("customRoleId");

ALTER TABLE "WorkspaceRoleDefinition" ADD CONSTRAINT "WorkspaceRoleDefinition_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "WorkspaceRoleDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TaskFlow uses server-side Prisma authorization; block direct Data API access.
ALTER TABLE "WorkspaceRoleDefinition" ENABLE ROW LEVEL SECURITY;
