import { assertPermission, errorResponse, requireWorkspaceBySlug } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
export async function GET(request: Request) { try { const slug = new URL(request.url).searchParams.get("workspace") || ""; const access = await requireWorkspaceBySlug(slug); assertPermission(access.subject, "EMAIL_VIEW"); const count = await prisma.inboundEmail.count({ where: { workspaceId: access.workspace.id, status: "UNTRIAGED" } }); return Response.json({ count }); } catch (error) { return errorResponse(error); } }
