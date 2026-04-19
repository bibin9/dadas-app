import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile") || "dadas";

  const [allMembers, groups, settings] = await Promise.all([
    prisma.member.findMany({ orderBy: { name: "asc" } }),
    prisma.memberGroup.findMany({
      include: { members: { include: { member: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.settings.findUnique({ where: { id: "main" } }),
  ]);

  // Filter members for Big Ticket profile
  let members = allMembers;
  if (profile === "bigticket" && settings?.bigTicketGroupId) {
    const group = groups.find((g) => g.id === settings.bigTicketGroupId);
    if (group) {
      const groupMemberIds = new Set(group.members.map((gm) => gm.member.id));
      members = allMembers.filter((m) => groupMemberIds.has(m.id));
    }
  }

  return NextResponse.json({ members, groups });
}
