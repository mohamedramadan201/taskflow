import { connectorTokenMatches } from "@/lib/email-connectors";
import { HttpError } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";

export async function requireEmailConnector(request: Request, connectorId: string) {
  const token = request.headers.get("x-taskflow-connector-token")?.trim();
  if (!token || token.length > 200) throw new HttpError(401, "Connector authentication required");
  const connector = await prisma.emailConnector.findUnique({ where: { id: connectorId }, include: { filters: { where: { enabled: true }, orderBy: { createdAt: "asc" } } } });
  if (!connector || !connectorTokenMatches(token, connector.tokenHash)) throw new HttpError(401, "Invalid connector credentials");
  return connector;
}
