import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// Auto-cleanup fully-paid matches older than N days
export async function POST() {
  try {
    const settings = await prisma.settings.findFirst({ where: { id: "main" } });
    const days = settings?.autoDeleteDays || 0;
    if (days <= 0) return NextResponse.json({ deleted: 0, message: "Auto-delete disabled" });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Find all matches (type="match") older than cutoff
    const oldMatches = await prisma.event.findMany({
      where: {
        type: "match",
        date: { lt: cutoffDate },
      },
      include: {
        dues: true,
        payments: true,
      },
    });

    // Filter to only fully settled matches (every due has a corresponding payment)
    const settledMatchIds: string[] = [];
    const carryForwardPayments: { memberId: string; amount: number; method: string; date: Date }[] = [];

    for (const match of oldMatches) {
      if (match.dues.length === 0) continue;
      const paidMemberIds = new Set(match.payments.map((p: { memberId: string }) => p.memberId));
      const allPaid = match.dues.every((d: { memberId: string }) => paidMemberIds.has(d.memberId));
      if (allPaid) {
        settledMatchIds.push(match.id);

        // Check for overpayments — carry forward the excess
        for (const due of match.dues) {
          const memberPayments = match.payments.filter((p) => p.memberId === due.memberId);
          const totalPaid = memberPayments.reduce((sum: number, p) => sum + p.amount, 0);
          const excess = totalPaid - due.amount;
          if (excess > 0.01) { // more than 1 fils overpaid
            carryForwardPayments.push({
              memberId: due.memberId,
              amount: excess,
              method: memberPayments[0]?.method || "cash",
              date: match.date,
            });
          }
        }
      }
    }

    if (settledMatchIds.length === 0) {
      return NextResponse.json({ deleted: 0, message: "No settled matches to clean up" });
    }

    // Create carry-forward payments for overpayments (unlinked to any event)
    if (carryForwardPayments.length > 0) {
      await prisma.payment.createMany({
        data: carryForwardPayments.map((cf) => ({
          memberId: cf.memberId,
          amount: cf.amount,
          method: cf.method,
          date: cf.date,
          reference: "Carry forward from settled match",
          notes: "Auto-carried excess payment",
          eventId: null,
        })),
      });
    }

    // Delete payments linked to these matches, then delete the matches
    await prisma.payment.deleteMany({
      where: { eventId: { in: settledMatchIds } },
    });
    await prisma.event.deleteMany({
      where: { id: { in: settledMatchIds } },
    });

    return NextResponse.json({
      deleted: settledMatchIds.length,
      carryForwards: carryForwardPayments.length,
      message: `Cleaned up ${settledMatchIds.length} match(es), ${carryForwardPayments.length} carry-forward credit(s) created`,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
