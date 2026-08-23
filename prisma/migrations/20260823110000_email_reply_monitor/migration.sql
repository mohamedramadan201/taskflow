CREATE TYPE "EmailMonitorStatus" AS ENUM ('WAITING', 'NEEDS_REPLY', 'HANDLED', 'REOPENED', 'NO_ACTION_NEEDED');

ALTER TABLE "EmailConnector"
  ADD COLUMN "monitorEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "monitorSlaHours" INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN "monitorResponderEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "monitorExcludedSenderEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "monitorExcludedSubjectKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "monitorSummaryRecipients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "monitorSummaryEveryHours" INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN "monitorLookbackDays" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "monitorLastSummaryAt" TIMESTAMP(3),
  ADD COLUMN "monitorSummaryClaimedAt" TIMESTAMP(3),
  ADD COLUMN "monitorSummaryLastError" TEXT;

CREATE TABLE "EmailMonitorThread" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "connectorId" TEXT NOT NULL,
  "gmailThreadId" TEXT NOT NULL,
  "status" "EmailMonitorStatus" NOT NULL DEFAULT 'WAITING',
  "latestRelevantSenderAddress" TEXT,
  "latestRelevantMessageAt" TIMESTAMP(3),
  "latestExternalMessageAt" TIMESTAMP(3),
  "teamReplyAt" TIMESTAMP(3),
  "slaDueAt" TIMESTAMP(3),
  "priority" TEXT,
  "agingBucket" TEXT,
  "manualNoActionAt" TIMESTAMP(3),
  "manualNoActionMessageAt" TIMESTAMP(3),
  "lastEvaluatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailMonitorThread_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailMonitorThread_connectorId_gmailThreadId_key" ON "EmailMonitorThread"("connectorId", "gmailThreadId");
CREATE INDEX "EmailMonitorThread_workspaceId_status_slaDueAt_idx" ON "EmailMonitorThread"("workspaceId", "status", "slaDueAt");
CREATE INDEX "EmailMonitorThread_connectorId_latestRelevantMessageAt_idx" ON "EmailMonitorThread"("connectorId", "latestRelevantMessageAt");

ALTER TABLE "EmailMonitorThread" ADD CONSTRAINT "EmailMonitorThread_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailMonitorThread" ADD CONSTRAINT "EmailMonitorThread_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "EmailConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailMonitorThread" ENABLE ROW LEVEL SECURITY;
