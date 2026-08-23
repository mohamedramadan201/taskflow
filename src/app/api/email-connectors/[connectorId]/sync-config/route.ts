import { connectorIsDue, normalizeRuleValue } from "@/lib/email-connectors";
import { errorResponse } from "@/lib/server/authorization";
import { requireEmailConnector } from "@/lib/server/email-connector-auth";
import { prisma } from "@/lib/server/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ connectorId: string }> }) {
  try {
    const { connectorId } = await params; const connector = await requireEmailConnector(request, connectorId, { allowDisabled: true }); const now = new Date(); const shouldSync = connectorIsDue(connector, now);
    await prisma.emailConnector.update({ where: { id: connector.id }, data: { lastHeartbeatAt: now, ...(shouldSync ? { lastSyncStartedAt: now } : {}) } });
    return Response.json({ connectorId: connector.id, mailboxAddress: connector.mailboxAddress, enabled: connector.enabled, syncIntervalMinutes: connector.syncIntervalMinutes, shouldSync, historyId: connector.historyId, syncRequestedAt: connector.syncRequestedAt?.toISOString() || null, configVersion: connector.configVersion, filters: connector.filters.map((rule) => ({ action: rule.action, field: rule.field, matchType: rule.matchType, value: normalizeRuleValue(rule) })), monitor: { enabled: connector.monitorEnabled, slaHours: connector.monitorSlaHours, responderEmails: connector.monitorResponderEmails, excludedSenderEmails: connector.monitorExcludedSenderEmails, excludedSubjectKeywords: connector.monitorExcludedSubjectKeywords, summaryRecipients: connector.monitorSummaryRecipients, summaryEveryHours: connector.monitorSummaryEveryHours, lookbackDays: connector.monitorLookbackDays } });
  } catch (error) { return errorResponse(error); }
}
