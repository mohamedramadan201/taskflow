CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE');

ALTER TABLE "User" ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "WorkspaceInvitation" ADD COLUMN "teamGroupId" TEXT;

CREATE INDEX "WorkspaceInvitation_teamGroupId_idx" ON "WorkspaceInvitation"("teamGroupId");

ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_teamGroupId_fkey" FOREIGN KEY ("teamGroupId") REFERENCES "TeamGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
