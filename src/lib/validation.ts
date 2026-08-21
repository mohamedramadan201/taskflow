import { z } from "zod";
export const roleSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
const optionalTaskCountSchema = z.number().int().min(0).max(1_000_000_000).optional().nullable();
const optionalMinutesSchema = z.number().int().min(0).max(1_000_000).optional().nullable();
export const taskInputSchema = z.object({
  workspaceId: z.string().min(1), title: z.string().trim().min(1).max(120), description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "NO_ACTION_NEEDED"]).optional(), priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueAt: z.string().datetime().optional().nullable(), assigneeUserId: z.string().min(1).optional().nullable(),
  followUpWith: z.string().trim().max(120).optional().nullable(),
  recurrence: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).optional(), recurrenceInterval: z.number().int().min(1).max(365).optional(),
  updatedProductsCount: optionalTaskCountSchema, newProductsCount: optionalTaskCountSchema,
  updatedImagesCount: optionalTaskCountSchema, newImagesCount: optionalTaskCountSchema,
  estimatedMinutes: optionalMinutesSchema, remainingMinutes: optionalMinutesSchema, actualMinutes: optionalMinutesSchema,
  blockedReason: z.string().trim().max(500).optional().nullable(), blockerTaskId: z.string().min(1).optional().nullable(),
});
export const taskPatchSchema = taskInputSchema.omit({ workspaceId: true }).partial().refine((data) => Object.keys(data).length > 0);
export const taskAssignmentSchema = z.object({ assigneeUserId: z.string().min(1) });
export const taskBulkActionSchema = z.object({
  taskIds: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(["ASSIGN", "STATUS", "PRIORITY", "DUE_DATE", "ADD_LABEL", "REMOVE_LABEL"]),
  assigneeUserId: z.string().min(1).nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "NO_ACTION_NEEDED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  labelId: z.string().min(1).optional(),
}).superRefine((value, context) => {
  const required: Record<typeof value.action, keyof typeof value> = { ASSIGN: "assigneeUserId", STATUS: "status", PRIORITY: "priority", DUE_DATE: "dueAt", ADD_LABEL: "labelId", REMOVE_LABEL: "labelId" };
  if (value[required[value.action]] === undefined) context.addIssue({ code: "custom", path: [required[value.action]], message: "This value is required for the selected action" });
});
export const reminderSchema = z.object({ scheduledAt: z.string().datetime(), userId: z.string().min(1).optional() });
export const commentSchema = z.object({ body: z.string().trim().min(1).max(2000) });
export const invitationSchema = z.object({ email: z.string().email(), role: roleSchema.default("MEMBER") });
export const invitationRegistrationSchema = z.object({ name: z.string().trim().min(2).max(80), password: z.string().min(8).max(128) });
export const automationEmailResultSchema = z.object({ kind: z.enum(["INVITATION", "NOTIFICATION"]), id: z.string().min(1), success: z.boolean(), error: z.string().trim().max(500).optional().nullable() });
export const teamGroupSchema = z.object({ name: z.string().trim().min(2).max(60) });
export const checklistItemSchema = z.object({ title: z.string().trim().min(1).max(200), completed: z.boolean().optional() });
export const notificationPreferenceSchema = z.object({ emailNotifications: z.boolean().optional(), taskReminderNotifications: z.boolean().optional() }).refine((data) => Object.keys(data).length > 0);
export const labelSchema = z.object({ name: z.string().trim().min(1).max(40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) });
export const taskLabelsSchema = z.object({ labelIds: z.array(z.string().min(1)).max(20) });
export const taskFilterSchema = z.object({
  query: z.string().max(120).default(""),
  statuses: z.array(z.enum(["TODO", "IN_PROGRESS", "DONE", "NO_ACTION_NEEDED"])).max(4).default([]),
  priorities: z.array(z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"])).max(4).default([]),
  assignees: z.array(z.string().min(1)).max(100).default([]),
  creator: z.string().max(100).default("all"),
  due: z.enum(["all", "overdue", "today", "tomorrow", "this-week", "next-week", "no-date", "custom"]).default("all"),
  dueFrom: z.string().max(10).default(""), dueTo: z.string().max(10).default(""),
  completed: z.enum(["all", "today", "this-week", "this-month"]).default("all"),
  recurrence: z.enum(["all", "recurring", "not-recurring"]).default("all"),
  followUpWith: z.string().max(120).default(""),
  teamGroupId: z.string().max(100).default(""),
  labels: z.array(z.string().min(1)).max(20).default([]),
  attention: z.boolean().default(false), mineOnly: z.boolean().default(false),
});
export const savedTaskViewSchema = z.object({ name: z.string().trim().min(1).max(60), shared: z.boolean().default(false), filters: taskFilterSchema });
export const savedTaskViewPatchSchema = savedTaskViewSchema.partial().refine((data) => Object.keys(data).length > 0);
export const emailFilterRuleSchema = z.object({
  action: z.enum(["INCLUDE", "EXCLUDE"]), field: z.enum(["SENDER", "RECIPIENT"]),
  matchType: z.enum(["EXACT", "DOMAIN"]), value: z.string().trim().min(1).max(254), enabled: z.boolean().default(true),
});
export const emailConnectorInputSchema = z.object({
  mailboxAddress: z.string().trim().toLowerCase().email(), displayName: z.string().trim().max(80).optional().nullable(),
  syncIntervalMinutes: z.union([z.literal(1), z.literal(5), z.literal(10), z.literal(15), z.literal(30), z.literal(60)]).default(5),
});
export const emailConnectorPatchSchema = z.object({
  displayName: z.string().trim().max(80).optional().nullable(), enabled: z.boolean().optional(),
  syncIntervalMinutes: z.union([z.literal(1), z.literal(5), z.literal(10), z.literal(15), z.literal(30), z.literal(60)]).optional(),
  filters: z.array(emailFilterRuleSchema).max(100).optional(),
}).refine((data) => Object.keys(data).length > 0);
export const inboundEmailSchema = z.object({
  gmailMessageId: z.string().min(1).max(200), gmailThreadId: z.string().min(1).max(200), internetMessageId: z.string().max(500).optional().nullable(),
  senderAddress: z.string().trim().toLowerCase().email(), senderName: z.string().trim().max(200).optional().nullable(),
  toAddresses: z.array(z.string().trim().toLowerCase().email()).max(100).default([]), ccAddresses: z.array(z.string().trim().toLowerCase().email()).max(100).default([]),
  deliveredTo: z.array(z.string().trim().toLowerCase().email()).max(20).default([]), subject: z.string().trim().max(500).default("(No subject)"),
  snippet: z.string().trim().max(1000).optional().nullable(), receivedAt: z.string().datetime(),
});
export const emailIngestSchema = z.object({
  historyId: z.string().max(100).optional().nullable(), emails: z.array(inboundEmailSchema).max(50), error: z.string().trim().max(500).optional().nullable(),
});
export const emailActionSchema = z.object({ status: z.enum(["UNTRIAGED", "DISMISSED", "NO_ACTION_NEEDED"]) });
export const emailBulkActionSchema = z.object({
  emailIds: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(["DISMISS", "NO_ACTION_NEEDED", "RESTORE", "ASSIGN"]),
  assigneeUserId: z.string().min(1).optional().nullable(),
});
export const emailConvertSchema = z.object({
  title: z.string().trim().min(1).max(120), description: z.string().trim().max(2000).optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"), dueAt: z.string().datetime().optional().nullable(),
  assigneeUserId: z.string().min(1).optional().nullable(), status: z.enum(["TODO", "IN_PROGRESS", "NO_ACTION_NEEDED"]).default("TODO"),
});
export const emailLinkSchema = z.object({ taskId: z.string().min(1) });
export async function parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const result = schema.safeParse(await request.json().catch(() => null));
  if (!result.success) throw new Response(JSON.stringify({ error: "Invalid request", details: result.error.flatten() }), { status: 400, headers: { "content-type": "application/json" } });
  return result.data;
}
