import { emailPassesRules } from "@/lib/email-connectors";
import { errorResponse } from "@/lib/server/authorization";
import { requireEmailConnector } from "@/lib/server/email-connector-auth";
import { prisma } from "@/lib/server/prisma";
import { emailIngestSchema, parseJson } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ connectorId: string }> }) {
  try {
    const { connectorId } = await params; const connector = await requireEmailConnector(request, connectorId); const input = await parseJson(request, emailIngestSchema); const now = new Date();
    if (input.error) { await prisma.emailConnector.update({ where: { id: connector.id }, data: { lastHeartbeatAt: now, lastError: input.error } }); return Response.json({ accepted: 0, errorRecorded: true }); }
    const accepted = input.emails.filter((email) => emailPassesRules(email, connector.mailboxAddress, connector.filters));
    const result = await prisma.$transaction(async (tx) => {
      const created = accepted.length ? await tx.inboundEmail.createMany({ skipDuplicates: true, data: accepted.map((email) => ({ workspaceId: connector.workspaceId, connectorId: connector.id, gmailMessageId: email.gmailMessageId, gmailThreadId: email.gmailThreadId, internetMessageId: email.internetMessageId || null, senderAddress: email.senderAddress, senderName: email.senderName || null, toAddresses: [...new Set(email.toAddresses)], ccAddresses: [...new Set(email.ccAddresses)], deliveredTo: [...new Set(email.deliveredTo)], subject: email.subject || "(No subject)", snippet: email.snippet || null, receivedAt: new Date(email.receivedAt) })) }) : { count: 0 };
      await tx.emailConnector.update({ where: { id: connector.id }, data: { historyId: input.historyId, lastHeartbeatAt: now, lastSyncAt: now, lastError: null, syncRequestedAt: null } });
      return created.count;
    });
    return Response.json({ accepted: result, filtered: input.emails.length - accepted.length, duplicates: accepted.length - result });
  } catch (error) { return errorResponse(error); }
}
