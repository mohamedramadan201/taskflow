-- Block access through Supabase's public Data API. TaskFlow uses its server-side
-- PostgreSQL connection and performs authorization in its route handlers.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Workspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reminder" ENABLE ROW LEVEL SECURITY;

CREATE INDEX "Task_createdByUserId_idx" ON "Task"("createdByUserId");
CREATE INDEX "ActivityEvent_taskId_idx" ON "ActivityEvent"("taskId");
CREATE INDEX "ActivityEvent_actorUserId_idx" ON "ActivityEvent"("actorUserId");
CREATE INDEX "Notification_workspaceId_idx" ON "Notification"("workspaceId");
CREATE INDEX "Notification_taskId_idx" ON "Notification"("taskId");
CREATE INDEX "Reminder_workspaceId_idx" ON "Reminder"("workspaceId");
CREATE INDEX "Reminder_taskId_idx" ON "Reminder"("taskId");
CREATE INDEX "Reminder_userId_idx" ON "Reminder"("userId");
