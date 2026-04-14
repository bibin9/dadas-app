import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// Combined endpoint: returns events, active members, settings, groups, and templates in one call
export async function GET() {
  const [events, members, settings, groups, templates] = await Promise.all([
    prisma.event.findMany({
      orderBy: { date: "desc" },
      include: {
        dues: { include: { member: true } },
        payments: { include: { member: true } },
      },
    }),
    prisma.member.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.settings.findFirst({ where: { id: "main" } }),
    prisma.memberGroup.findMany({
      include: { members: { include: { member: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.eventTemplate.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  // Run cleanup in background (non-blocking)
  const autoDeleteDays = settings?.autoDeleteDays || 0;
  if (autoDeleteDays > 0) {
    cleanupSettledMatches(autoDeleteDays).catch(() => {});
  }

  return NextResponse.json({
    events,
    members,
    settings: settings || { defaultMatchFee: 20, groupName: "Company", autoDeleteDays: 0 },
    groups,
    templates,
  });
}

async function cleanupSettledMatches(days: number) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const oldMatches = await prisma.event.findMany({
    where: { type: "match", date: { lt: cutoffDate } },
    include: { dues: true, payments: true },
  });
  const settledIds: string[] = [];
  const carryForwards: { memberId: string; amount: number; method: string; date: Date }[] = [];

  for (const match of oldMatches) {
    if (match.dues.length === 0) continue;
    const paidMemberIds = new Set(match.payments.map((p) => p.memberId));
    if (match.dues.every((d) => paidMemberIds.has(d.memberId))) {
      settledIds.push(match.id);
      // Carry forward overpayments
      for (const due of match.dues) {
        const memberPays = match.payments.filter((p) => p.memberId === due.memberId);
        const totalPaid = memberPays.reduce((s: number, p) => s + p.amount, 0);
        const excess = totalPaid - due.amount;
        if (excess > 0.01) {
          carryForwards.push({ memberId: due.memberId, amount: excess, method: memberPays[0]?.method || "cash", date: match.date });
        }
      }
    }
  }
  if (settledIds.length > 0) {
    if (carryForwards.length > 0) {
      await prisma.payment.createMany({
        data: carryForwards.map((cf) => ({
          memberId: cf.memberId, amount: cf.amount, method: cf.method, date: cf.date,
          reference: "Carry forward from settled match", notes: "Auto-carried excess payment", eventId: null,
        })),
      });
    }
    await prisma.payment.deleteMany({ where: { eventId: { in: settledIds } } });
    await prisma.event.deleteMany({ where: { id: { in: settledIds } } });
  }
}
