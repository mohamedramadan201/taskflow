CREATE TABLE "WorkspaceInvitation" ("id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "email" TEXT NOT NULL, "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER', "token" TEXT NOT NULL, "invitedByUserId" TEXT NOT NULL, "acceptedByUserId" TEXT, "expiresAt" TIMESTAMP(3) NOT NULL, "acceptedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "WorkspaceInvitation_token_key" ON "WorkspaceInvitation"("token");
CREATE UNIQUE INDEX "WorkspaceInvitation_workspaceId_email_key" ON "WorkspaceInvitation"("workspaceId", "email");
CREATE INDEX "WorkspaceInvitation_email_expiresAt_idx" ON "WorkspaceInvitation"("email", "expiresAt");
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvitation" ENABLE ROW LEVEL SECURITY;
