import { z } from "zod";
import { assertPermission, HttpError, errorResponse, requireMembership } from "@/lib/server/authorization";
import { prisma } from "@/lib/server/prisma";
import { parseJson } from "@/lib/validation";

const schema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), availableMinutes: z.number().int().min(0).max(1440), note: z.string().trim().max(120).optional().nullable() });

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string; memberUserId: string }> }) {
  try {
    const { workspaceId, memberUserId } = await params; const { user, subject } = await requireMembership(workspaceId);
    assertPermission(subject, "MEMBER_MANAGE", "Availability management denied");
    const input = await parseJson(request, schema);
    const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: memberUserId } }, select: { id: true } });
    if (!member) throw new HttpError(404, "Member not found");
    const date = new Date(`${input.date}T00:00:00.000Z`); if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.date) throw new HttpError(400, "Invalid availability date");
    const availability = await prisma.$transaction(async (tx) => {
      const saved = await tx.memberAvailability.upsert({ where: { workspaceMemberId_date: { workspaceMemberId: member.id, date } }, create: { workspaceId, workspaceMemberId: member.id, date, availableMinutes: input.availableMinutes, note: input.note }, update: { availableMinutes: input.availableMinutes, note: input.note } });
      await tx.activityEvent.create({ data: { workspaceId, actorUserId: user.id, type: "MEMBER_AVAILABILITY_CHANGED", detailsJson: { targetUserId: memberUserId, date: input.date, availableMinutes: input.availableMinutes } } });
      return saved;
    });
    return Response.json(availability);
  } catch (error) { return error instanceof Response ? error : errorResponse(error); }
}
