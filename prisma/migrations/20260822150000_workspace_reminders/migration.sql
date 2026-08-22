-- Native workspace reminders translated from the standalone Reminder app.
CREATE TYPE "WorkspaceReminderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'DONE', 'CANCELLED', 'ERROR');
CREATE TYPE "WorkspaceReminderPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE "WorkspaceReminder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "assignedEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "reminderAt" TIMESTAMP(3) NOT NULL,
    "status" "WorkspaceReminderStatus" NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "errorMessage" TEXT,
    "repeatType" "RecurrenceType" NOT NULL DEFAULT 'NONE',
    "repeatInterval" INTEGER NOT NULL DEFAULT 1,
    "repeatEndDate" TIMESTAMP(3),
    "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "priority" "WorkspaceReminderPriority" NOT NULL DEFAULT 'MEDIUM',
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "calendarPopupMinutes" INTEGER NOT NULL DEFAULT 10,
    "snoozedAt" TIMESTAMP(3),
    "snoozeCount" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "WorkspaceReminder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceReminderLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "reminderId" TEXT,
    "taskTitle" TEXT NOT NULL,
    "assignedEmails" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceReminderLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceReminderSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "defaultAssignedEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "assigneeDirectoryEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "defaultCalendarPopupMinutes" INTEGER NOT NULL DEFAULT 10,
    "defaultEmailIntro" TEXT NOT NULL DEFAULT E'Hello,\\n\\nThis is a reminder for the following task:',
    "defaultEmailSignature" TEXT NOT NULL DEFAULT E'Regards,\\nTaskFlow',
    "sendCopyToCreator" BOOLEAN NOT NULL DEFAULT false,
    "archiveAfterDays" INTEGER NOT NULL DEFAULT 90,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceReminderSettings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkspaceReminder_workspaceId_status_reminderAt_idx" ON "WorkspaceReminder"("workspaceId", "status", "reminderAt");
CREATE INDEX "WorkspaceReminder_workspaceId_createdAt_idx" ON "WorkspaceReminder"("workspaceId", "createdAt");
CREATE INDEX "WorkspaceReminder_createdByUserId_idx" ON "WorkspaceReminder"("createdByUserId");
CREATE INDEX "WorkspaceReminderLog_workspaceId_createdAt_idx" ON "WorkspaceReminderLog"("workspaceId", "createdAt");
CREATE INDEX "WorkspaceReminderLog_reminderId_createdAt_idx" ON "WorkspaceReminderLog"("reminderId", "createdAt");
CREATE UNIQUE INDEX "WorkspaceReminderSettings_workspaceId_key" ON "WorkspaceReminderSettings"("workspaceId");

ALTER TABLE "WorkspaceReminder" ADD CONSTRAINT "WorkspaceReminder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceReminder" ADD CONSTRAINT "WorkspaceReminder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkspaceReminderLog" ADD CONSTRAINT "WorkspaceReminderLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceReminderLog" ADD CONSTRAINT "WorkspaceReminderLog_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "WorkspaceReminder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkspaceReminderSettings" ADD CONSTRAINT "WorkspaceReminderSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TaskFlow performs authorization in its server-side route handlers. Keep the
-- new public-schema tables protected from direct Supabase Data API access.
ALTER TABLE "WorkspaceReminder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceReminderLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceReminderSettings" ENABLE ROW LEVEL SECURITY;
