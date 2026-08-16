CREATE TYPE "InboundEmailStatus" AS ENUM ('UNTRIAGED', 'CONVERTED', 'DISMISSED');
CREATE TYPE "EmailFilterAction" AS ENUM ('INCLUDE', 'EXCLUDE');
CREATE TYPE "EmailFilterField" AS ENUM ('SENDER', 'RECIPIENT');
CREATE TYPE "EmailFilterMatchType" AS ENUM ('EXACT', 'DOMAIN');

CREATE TABLE "EmailConnector" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "mailboxAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "tokenHash" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 5,
    "historyId" TEXT,
    "configVersion" INTEGER NOT NULL DEFAULT 1,
    "syncRequestedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastSyncStartedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailConnector_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailFilterRule" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "action" "EmailFilterAction" NOT NULL,
    "field" "EmailFilterField" NOT NULL,
    "matchType" "EmailFilterMatchType" NOT NULL,
    "value" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailFilterRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InboundEmail" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "gmailThreadId" TEXT NOT NULL,
    "internetMessageId" TEXT,
    "senderAddress" TEXT NOT NULL,
    "senderName" TEXT,
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[],
    "deliveredTo" TEXT[],
    "subject" TEXT NOT NULL,
    "snippet" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "status" "InboundEmailStatus" NOT NULL DEFAULT 'UNTRIAGED',
    "taskId" TEXT,
    "handledByUserId" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailConnector_tokenHash_key" ON "EmailConnector"("tokenHash");
CREATE UNIQUE INDEX "EmailConnector_workspaceId_mailboxAddress_key" ON "EmailConnector"("workspaceId", "mailboxAddress");
CREATE INDEX "EmailConnector_workspaceId_enabled_createdAt_idx" ON "EmailConnector"("workspaceId", "enabled", "createdAt");
CREATE INDEX "EmailConnector_createdByUserId_idx" ON "EmailConnector"("createdByUserId");
CREATE INDEX "EmailFilterRule_connectorId_enabled_idx" ON "EmailFilterRule"("connectorId", "enabled");
CREATE UNIQUE INDEX "InboundEmail_connectorId_gmailMessageId_key" ON "InboundEmail"("connectorId", "gmailMessageId");
CREATE INDEX "InboundEmail_workspaceId_status_receivedAt_idx" ON "InboundEmail"("workspaceId", "status", "receivedAt");
CREATE INDEX "InboundEmail_connectorId_receivedAt_idx" ON "InboundEmail"("connectorId", "receivedAt");
CREATE INDEX "InboundEmail_taskId_idx" ON "InboundEmail"("taskId");
CREATE INDEX "InboundEmail_handledByUserId_idx" ON "InboundEmail"("handledByUserId");

ALTER TABLE "EmailConnector" ADD CONSTRAINT "EmailConnector_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailConnector" ADD CONSTRAINT "EmailConnector_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailFilterRule" ADD CONSTRAINT "EmailFilterRule_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "EmailConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "EmailConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_handledByUserId_fkey" FOREIGN KEY ("handledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- These tables are accessed only through authenticated TaskFlow server routes.
-- Enabling RLS prevents accidental exposure through Supabase's public Data API.
ALTER TABLE "EmailConnector" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailFilterRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InboundEmail" ENABLE ROW LEVEL SECURITY;
