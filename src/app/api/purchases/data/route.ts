import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const [purchases, allMembers, groups, settings, templates] = await Promise.all([
    prisma.purchase.findMany({
      orderBy: { date: "desc" },
      include: { splits: { include: { member: true } } },
    }),
    prisma.member.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.memberGroup.findMany({
      include: { members: { include: { member: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.settings.findUnique({ where: { id: "main" } }),
    prisma.eventTemplate.findMany({ where: { type: "purchase" }, orderBy: { createdAt: "desc" } }),
  ]);

  // Filter members to Big Ticket group if set
  const bigTicketGroupId = settings?.bigTicketGroupId || "";
  let members = allMembers;
  if (bigTicketGroupId) {
    const group = groups.find((g) => g.id === bigTicketGroupId);
    if (group) {
      const groupMemberIds = new Set(group.members.map((gm) => gm.member.id));
      members = allMembers.filter((m) => groupMemberIds.has(m.id));
    }
  }

  return NextResponse.json({ purchases, members, groups, defaultShare: settings?.defaultBigTicketShare ?? 50, templates });
}
