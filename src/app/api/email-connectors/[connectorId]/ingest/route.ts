import { dedupeInboundEmails, emailPassesRules } from "@/lib/email-connectors";
import { emailMonitorMessageIsExcluded, evaluateEmailMonitorThread } from "@/lib/email-monitor";
import { errorResponse } from "@/lib/server/authorization";
import { requireEmailConnector } from "@/lib/server/email-connector-auth";
import { prisma } from "@/lib/server/prisma";
import { emailIngestSchema, parseJson } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ connectorId: string }> }) {
  try {
    const { connectorId } = await params; const connector = await requireEmailConnector(request, connectorId); const input = await parseJson(request, emailIngestSchema); const now = new Date();
    if (input.error) { await prisma.emailConnector.update({ where: { id: connector.id }, data: { lastHeartbeatAt: now, lastError: input.error } }); return Response.json({ accepted: 0, errorRecorded: true }); }
    const accepted = input.emails.filter((email) => emailPassesRules(email, connector.mailboxAddress, connector.filters) && !(connector.monitorEnabled && emailMonitorMessageIsExcluded(email, { excludedSenderEmails: connector.monitorExcludedSenderEmails, excludedSubjectKeywords: connector.monitorExcludedSubjectKeywords })));
    const uniqueAccepted = dedupeInboundEmails(accepted);
    const result = await prisma.$transaction(async (tx) => {
      const internetMessageIds = [...new Set(uniqueAccepted.map((email) => email.internetMessageId?.trim().toLowerCase()).filter((value): value is string => Boolean(value)))];
      const identityFilters = uniqueAccepted.length ? [
        { connectorId: connector.id, gmailMessageId: { in: uniqueAccepted.map((email) => email.gmailMessageId) } },
        ...(internetMessageIds.length ? [{ workspaceId: connector.workspaceId, internetMessageId: { in: internetMessageIds } }] : []),
      ] : [];
      const existing = identityFilters.length ? await tx.inboundEmail.findMany({ where: { OR: identityFilters.map((filter) => "internetMessageId" in filter ? { ...filter, internetMessageId: { ...filter.internetMessageId, mode: "insensitive" as const } } : filter) }, select: { gmailMessageId: true, internetMessageId: true } }) : [];
      const existingGmailIds = new Set(existing.map((email) => email.gmailMessageId));
      const existingInternetMessageIds = new Set(existing.map((email) => email.internetMessageId?.trim().toLowerCase()).filter((value): value is string => Boolean(value)));
      const fresh = uniqueAccepted.filter((email) => !existingGmailIds.has(email.gmailMessageId) && !(email.internetMessageId && existingInternetMessageIds.has(email.internetMessageId.trim().toLowerCase())));
      const created = fresh.length ? await tx.inboundEmail.createMany({ skipDuplicates: true, data: fresh.map((email) => ({ workspaceId: connector.workspaceId, connectorId: connector.id, gmailMessageId: email.gmailMessageId, gmailThreadId: email.gmailThreadId, internetMessageId: email.internetMessageId?.trim().toLowerCase() || null, senderAddress: email.senderAddress, senderName: email.senderName || null, toAddresses: [...new Set(email.toAddresses)], ccAddresses: [...new Set(email.ccAddresses)], deliveredTo: [...new Set(email.deliveredTo)], subject: email.subject || "(No subject)", snippet: email.snippet || null, receivedAt: new Date(email.receivedAt) })) }) : { count: 0 };
      if (connector.monitorEnabled) {
        for (const snapshot of input.threadSnapshots) {
          const previous = await tx.emailMonitorThread.findUnique({ where: { connectorId_gmailThreadId: { connectorId: connector.id, gmailThreadId: snapshot.gmailThreadId } } });
          const evaluation = evaluateEmailMonitorThread(snapshot.messages.map((message) => ({ ...message, receivedAt: new Date(message.receivedAt) })), { targetAddress: connector.mailboxAddress, responderEmails: connector.monitorResponderEmails, slaHours: connector.monitorSlaHours, excludedSenderEmails: connector.monitorExcludedSenderEmails, excludedSubjectKeywords: connector.monitorExcludedSubjectKeywords }, now, previous?.status === "HANDLED" || previous?.status === "REOPENED", previous?.manualNoActionMessageAt || null);
          const latestExternal = evaluation.latestExternalMessageAt;
          const manualStillApplies = Boolean(previous?.manualNoActionMessageAt && latestExternal && latestExternal.getTime() <= previous.manualNoActionMessageAt.getTime());
          await tx.emailMonitorThread.upsert({
            where: { connectorId_gmailThreadId: { connectorId: connector.id, gmailThreadId: snapshot.gmailThreadId } },
            create: { workspaceId: connector.workspaceId, connectorId: connector.id, gmailThreadId: snapshot.gmailThreadId, status: evaluation.status, latestRelevantSenderAddress: evaluation.latestRelevantSenderAddress, latestRelevantMessageAt: evaluation.latestRelevantMessageAt, latestExternalMessageAt: evaluation.latestExternalMessageAt, teamReplyAt: evaluation.teamReplyAt, slaDueAt: evaluation.slaDueAt, priority: evaluation.priority, agingBucket: evaluation.agingBucket, lastEvaluatedAt: now },
            update: { status: evaluation.status, latestRelevantSenderAddress: evaluation.latestRelevantSenderAddress, latestRelevantMessageAt: evaluation.latestRelevantMessageAt, latestExternalMessageAt: evaluation.latestExternalMessageAt, teamReplyAt: evaluation.teamReplyAt, slaDueAt: evaluation.slaDueAt, priority: evaluation.priority, agingBucket: evaluation.agingBucket, lastEvaluatedAt: now, ...(manualStillApplies ? {} : { manualNoActionAt: null, manualNoActionMessageAt: null }) },
          });
        }
      }
      await tx.emailConnector.update({ where: { id: connector.id }, data: { lastHeartbeatAt: now, lastError: null, ...(input.syncComplete ? { historyId: input.historyId, lastSyncAt: now, syncRequestedAt: null } : {}) } });
      return created.count;
    });
    return Response.json({ accepted: result, filtered: input.emails.length - accepted.length, duplicates: accepted.length - result });
  } catch (error) { return errorResponse(error); }
}
