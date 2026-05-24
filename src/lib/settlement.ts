/**
 * FIFO settlement engine — applies a member's payments to their dues in
 * chronological order, so overpayments naturally settle older outstanding
 * dues and credits naturally cover new charges.
 *
 * Used by reports so per-event "paid / unpaid" reflects the member's true
 * settled state (not just whether a payment record was directly linked to
 * the event).
 */

export interface DueInput {
  eventId: string;
  eventDate: Date | string;
  amount: number;
  memberId: string;
}

export interface PaymentInput {
  paymentId: string;
  date: Date | string;
  amount: number; // 0 for credit-method (carries no new cash)
  method: string;
  eventId: string | null;
  memberId: string;
}

export interface SettlementResult {
  // Per event: how much of this event's due is effectively covered by payments
  effectivePaidByEvent: Map<string, number>;
  // Per event: outstanding (= due - effective paid)
  outstandingByEvent: Map<string, number>;
  // Total credit left over after covering all dues (member's overall surplus)
  unallocatedCredit: number;
}

/**
 * Run FIFO settlement for a SINGLE member.
 * - Sort dues + payments chronologically (payments before dues on same date).
 * - For each payment, apply to oldest unpaid due first.
 * - Excess becomes credit, which applies to subsequent dues.
 */
export function settleMember(
  dues: DueInput[],
  payments: PaymentInput[]
): SettlementResult {
  const effectivePaidByEvent = new Map<string, number>();
  const outstandingByEvent = new Map<string, number>();
  // Initialize all dues with 0 effective paid
  for (const d of dues) {
    effectivePaidByEvent.set(d.eventId, 0);
    outstandingByEvent.set(d.eventId, d.amount);
  }

  // Build a chronological event stream. Same-date: payments first so they can
  // settle the same-day due (e.g. paying cash on match day for that day's due).
  type StreamItem =
    | { kind: "due"; date: number; eventId: string; amount: number }
    | { kind: "payment"; date: number; amount: number };
  const stream: StreamItem[] = [];
  for (const d of dues) {
    stream.push({ kind: "due", date: toMs(d.eventDate), eventId: d.eventId, amount: d.amount });
  }
  for (const p of payments) {
    // Skip credit-method (amount=0) payments — they represent the player choosing
    // to use existing credit, but FIFO already does that automatically.
    if (p.amount <= 0) continue;
    stream.push({ kind: "payment", date: toMs(p.date), amount: p.amount });
  }
  stream.sort((a, b) => {
    if (a.date !== b.date) return a.date - b.date;
    // Payments before dues on the same date so same-day payment covers same-day due
    if (a.kind !== b.kind) return a.kind === "payment" ? -1 : 1;
    return 0;
  });

  // Queue of unpaid dues (FIFO)
  const unpaidQueue: { eventId: string; remaining: number }[] = [];
  let creditPool = 0; // money already received but not yet allocated to any due

  for (const item of stream) {
    if (item.kind === "due") {
      // Try to cover this new due from the credit pool first
      let toCover = item.amount;
      const used = Math.min(creditPool, toCover);
      creditPool -= used;
      toCover -= used;
      // Record what we just covered
      if (used > 0) {
        effectivePaidByEvent.set(item.eventId, (effectivePaidByEvent.get(item.eventId) || 0) + used);
        outstandingByEvent.set(item.eventId, (outstandingByEvent.get(item.eventId) || 0) - used);
      }
      // If still uncovered, push remainder onto unpaid queue
      if (toCover > 0.001) {
        unpaidQueue.push({ eventId: item.eventId, remaining: toCover });
      }
    } else {
      // Payment: apply to oldest unpaid due first
      let remaining = item.amount;
      while (remaining > 0.001 && unpaidQueue.length > 0) {
        const oldest = unpaidQueue[0];
        const used = Math.min(oldest.remaining, remaining);
        oldest.remaining -= used;
        remaining -= used;
        effectivePaidByEvent.set(oldest.eventId, (effectivePaidByEvent.get(oldest.eventId) || 0) + used);
        outstandingByEvent.set(oldest.eventId, (outstandingByEvent.get(oldest.eventId) || 0) - used);
        if (oldest.remaining <= 0.001) unpaidQueue.shift();
      }
      // Anything left over goes into the credit pool for future dues
      if (remaining > 0.001) creditPool += remaining;
    }
  }

  return {
    effectivePaidByEvent,
    outstandingByEvent,
    unallocatedCredit: creditPool,
  };
}

function toMs(d: Date | string): number {
  return typeof d === "string" ? new Date(d).getTime() : d.getTime();
}
