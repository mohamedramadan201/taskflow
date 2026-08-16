CREATE TABLE "ChecklistItem" ("id" TEXT NOT NULL, "taskId" TEXT NOT NULL, "title" TEXT NOT NULL, "completed" BOOLEAN NOT NULL DEFAULT false, "position" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ChecklistItem_taskId_position_idx" ON "ChecklistItem"("taskId", "position");
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChecklistItem" ENABLE ROW LEVEL SECURITY;
