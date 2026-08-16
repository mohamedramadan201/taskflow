CREATE TYPE "RecurrenceType" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');

ALTER TABLE "Task"
ADD COLUMN "recurrence" "RecurrenceType" NOT NULL DEFAULT 'NONE',
ADD COLUMN "recurrenceInterval" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "recurrenceProcessedAt" TIMESTAMP(3);

ALTER TABLE "User"
ADD COLUMN "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "taskReminderNotifications" BOOLEAN NOT NULL DEFAULT true;
