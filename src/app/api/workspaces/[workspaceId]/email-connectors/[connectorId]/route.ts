import { normalizeRuleValue } from "@/lib/email-connectors";
import { assertPermission, HttpError, errorResponse, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { emailConnectorPatchSchema, parseJson } from "@/lib/validation";

function validRule(rule: { matchType: "EXACT" | "DOMAIN"; value: string }) {
  const value = normalizeRuleValue(rule);
  return rule.matchType === "EXACT" ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) : /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(value);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ workspaceId: string; connectorId: string }> }) {
  try {
    const { workspaceId, connectorId } = await params; const access = await requireMembership(workspaceId); assertPermission(access.subject, "EMAIL_CONNECTOR_MANAGE");
    const existing = await prisma.emailConnector.findFirst({ where: { id: connectorId, workspaceId }, select: { id: true } }); if (!existing) throw new HttpError(404, "Email connection not found");
    const input = await parseJson(request, emailConnectorPatchSchema); if (input.filters?.some((rule) => !validRule(rule))) throw new HttpError(400, "Filter values must be valid email addresses or domains");
    const updated = await prisma.$transaction(async (tx) => {
      await tx.emailConnector.update({ where: { id: connectorId }, data: { displayName: input.displayName, enabled: input.enabled, syncIntervalMinutes: input.syncIntervalMinutes, configVersion: { increment: 1 } } });
      if (input.filters) { await tx.emailFilterRule.deleteMany({ where: { connectorId } }); if (input.filters.length) await tx.emailFilterRule.createMany({ data: input.filters.map((rule) => ({ ...rule, value: normalizeRuleValue(rule), connectorId })) }); }
      await tx.activityEvent.create({ data: { workspaceId, actorUserId: access.user.id, type: "EMAIL_CONNECTOR_UPDATED", detailsJson: { connectorId, fields: Object.keys(input) } } });
      return tx.emailConnector.findUniqueOrThrow({ where: { id: connectorId }, omit: { tokenHash: true }, include: { filters: { orderBy: { createdAt: "asc" } }, _count: { select: { emails: true } } } });
    });
    return Response.json(updated);
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ workspaceId: string; connectorId: string }> }) {
  try {
    const { workspaceId, connectorId } = await params; const access = await requireMembership(workspaceId); assertPermission(access.subject, "EMAIL_CONNECTOR_MANAGE");
    const connector = await prisma.emailConnector.findFirst({ where: { id: connectorId, workspaceId }, select: { id: true, mailboxAddress: true } }); if (!connector) throw new HttpError(404, "Email connection not found");
    await prisma.$transaction([prisma.activityEvent.create({ data: { workspaceId, actorUserId: access.user.id, type: "EMAIL_CONNECTOR_DELETED", detailsJson: connector } }), prisma.emailConnector.delete({ where: { id: connectorId } })]);
    return new Response(null, { status: 204 });
  } catch (error) { return errorResponse(error); }
}
