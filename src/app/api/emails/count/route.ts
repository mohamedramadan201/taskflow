import { assertPermission, errorResponse, requireWorkspaceBySlug } from "@/lib/server/authorization";
import { emailVisibilityWhere } from "@/lib/server/record-access";
import { prisma } from "@/lib/server/prisma";

export async function GET(request: Request) {
  try {
    const slug = new URL(request.url).searchParams.get("workspace") || "";
    const access = await requireWorkspaceBySlug(slug);
    assertPermission(access.subject, "EMAIL_VIEW");
    const visibleEmails = await emailVisibilityWhere(access.workspace.id, access.user.id, access.user.email);
    const count = await prisma.inboundEmail.count({ where: { AND: [visibleEmails, { status: "UNTRIAGED" }] } });
    return Response.json({ count });
  } catch (error) {
    return errorResponse(error);
  }
}
