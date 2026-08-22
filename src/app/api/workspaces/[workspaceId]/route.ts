import { z } from "zod";
import { errorResponse, requireWorkspaceOwner } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { parseJson } from "@/lib/validation";

const workspacePatchSchema = z.object({ name: z.string().trim().min(2).max(80) });

export async function PATCH(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceOwner(workspaceId);
    const input = await parseJson(request, workspacePatchSchema);
    return Response.json(await prisma.workspace.update({ where: { id: workspaceId }, data: { name: input.name }, select: { id: true, name: true, slug: true } }));
  } catch (error) {
    return errorResponse(error);
  }
}
