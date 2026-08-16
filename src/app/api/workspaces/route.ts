import { z } from "zod";
import { requireUser, errorResponse } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { parseJson } from "@/lib/validation";
export async function GET() { try { const user = await requireUser(); return Response.json(await prisma.workspace.findMany({ where: { members: { some: { userId: user.id } } }, select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } })); } catch (e) { return errorResponse(e); } }
export async function POST(request: Request) { try {
  const user = await requireUser(); const input = await parseJson(request, z.object({ name: z.string().trim().min(2).max(80), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60) }));
  if (await prisma.workspace.findUnique({ where: { slug: input.slug }, select: { id: true } })) return Response.json({ error: "Workspace URL is already in use" }, { status: 409 });
  const workspace = await prisma.workspace.create({ data: { ...input, members: { create: { userId: user.id, role: "OWNER" } } } });
  return Response.json(workspace, { status: 201 });
} catch (e) { return e instanceof Response ? e : errorResponse(e); } }
