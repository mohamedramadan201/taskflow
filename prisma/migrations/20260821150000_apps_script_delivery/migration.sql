ALTER TABLE "WorkspaceInvitation"
ADD COLUMN "emailSentAt" TIMESTAMP(3),
ADD COLUMN "emailStatus" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "emailAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "emailLastError" TEXT,
ADD COLUMN "emailClaimedAt" TIMESTAMP(3);

ALTER TABLE "Notification"
ADD COLUMN "emailClaimedAt" TIMESTAMP(3);

CREATE INDEX "WorkspaceInvitation_emailStatus_expiresAt_idx" ON "WorkspaceInvitation"("emailStatus", "expiresAt");
