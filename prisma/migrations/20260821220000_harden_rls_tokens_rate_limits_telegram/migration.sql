-- TaskFlow uses server-side Prisma authorization. Enable RLS on every public
-- application table so direct Data API access has no rows by default.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Workspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemberAvailability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceRoleDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailConnector" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailFilterRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InboundEmail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskLabel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskLabelAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedTaskView" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChecklistItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceInvitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reminder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TelegramConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TelegramLinkToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TelegramUpdate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- Preserve existing invitation URLs while replacing recoverable token storage.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE "WorkspaceInvitation" ADD COLUMN "tokenHash" TEXT;
UPDATE "WorkspaceInvitation" SET "tokenHash" = encode(digest("token", 'sha256'), 'hex');
ALTER TABLE "WorkspaceInvitation" ALTER COLUMN "tokenHash" SET NOT NULL;
ALTER TABLE "WorkspaceInvitation" DROP CONSTRAINT IF EXISTS "WorkspaceInvitation_token_key";
ALTER TABLE "WorkspaceInvitation" DROP COLUMN "token";
CREATE UNIQUE INDEX "WorkspaceInvitation_tokenHash_key" ON "WorkspaceInvitation"("tokenHash");

ALTER TABLE "Task" ADD COLUMN "telegramUpdateId" TEXT;
CREATE UNIQUE INDEX "Task_telegramUpdateId_key" ON "Task"("telegramUpdateId");

CREATE TYPE "TelegramUpdateStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');
ALTER TABLE "TelegramUpdate" ADD COLUMN "status" "TelegramUpdateStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "TelegramUpdate" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TelegramUpdate" ADD COLUMN "lockedUntil" TIMESTAMP(3);
ALTER TABLE "TelegramUpdate" ADD COLUMN "nextAttemptAt" TIMESTAMP(3);
ALTER TABLE "TelegramUpdate" ADD COLUMN "processedAt" TIMESTAMP(3);
ALTER TABLE "TelegramUpdate" ADD COLUMN "lastError" TEXT;
CREATE INDEX "TelegramUpdate_status_nextAttemptAt_idx" ON "TelegramUpdate"("status", "nextAttemptAt");

CREATE TABLE "RateLimitBucket" (
  "key" TEXT NOT NULL,
  "windowStartedAt" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");
ALTER TABLE "RateLimitBucket" ENABLE ROW LEVEL SECURITY;
