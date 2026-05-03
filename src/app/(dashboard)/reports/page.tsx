"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatAED, formatDate } from "@/lib/format";
import { useProfile } from "@/lib/profile-context";

interface IncomeItem { description: string; amount: number; category: string }
interface ExpenseItem { description: string; amount: number; category: string }

interface EventReport {
  id: string; name: string; type: string; date: string; perHeadFee: number; totalCost: number;
  totalDue: number; totalPaid: number; outstanding: number;
  totalIncome: number; incomes: IncomeItem[];
  totalExpenses: number; expenses: ExpenseItem[];
  totalRevenue: number; totalCosts: number; netPL: number;
  playerCount: number; paidCount: number; unpaidCount: number;
  paidMembers: { name: string; amount: number; paidAmount: number; isGuest: boolean; method?: string }[];
  unpaidMembers: { name: string; amount: number; isGuest: boolean }[];
}
interface OutstandingMember {
  id: string; name: string; phone: string; totalDue: number; totalPaid: number; balance: number;
}
interface PurchaseReport {
  id: string; name: string; date: string; totalAmount: number;
}

export default function ReportsPage() {
  return <Suspense fallback={<div className="text-gray-700 font-medium p-4">Loading...</div>}><ReportsContent /></Suspense>;
}

function ReportsContent() {
  const searchParams = useSearchParams();
  const { profile } = useProfile();
  const [eventReports, setEventReports] = useState<EventReport[]>([]);
  const [outstandingReport, setOutstandingReport] = useState<OutstandingMember[]>([]);
  const [purchaseReports, setPurchaseReports] = useState<PurchaseReport[]>([]);
  const [groupName, setGroupName] = useState("Company");
  const initialTab = searchParams.get("tab") === "outstanding" ? "outstanding" : "events";
  const [tab, setTab] = useState<"events" | "outstanding">(initialTab);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setEventReports([]);
    setOutstandingReport([]);
    setPurchaseReports([]);
    fetch(`/api/reports?profile=${profile}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        // Guard: only apply if response matches current profile
        if (data.profile && data.profile !== profile) return;
        setEventReports(data.eventReports || []);
        setOutstandingReport(data.outstandingReport || []);
        setPurchaseReports(data.purchaseReports || []);
        setGroupName(data.groupName);
        if (profile === "bigticket") setTab("outstanding");
      })
      .catch((e) => { if (e.name !== "AbortError") console.error(e); });
    return () => ctrl.abort();
  }, [profile]);

  async function shareText(text: string) {
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(text); alert("Copied to clipboard!"); } catch { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank"); }
  }

  const incomeCatLabel = (c: string) => c === "sponsorship" ? "Sponsorship" : c === "donation" ? "Donation" : c === "prize" ? "Prize Money" : "Other";
  const expenseCatLabel = (c: string) => ({ venue: "Venue", equipment: "Equipment", referee: "Referee", transport: "Transport", food: "Food & Drinks", trophy: "Trophy/Medals", medical: "Medical" }[c] || "Other");

  // WhatsApp share for single event with P&L
  function shareEventWhatsApp(ev: EventReport) {
    const isMatch = ev.type === "match";
    const num = (n: number) => n.toFixed(2);

    // Column widths for the paid table
    const allNames = [...ev.paidMembers, ...ev.unpaidMembers].map((m) => m.name);
    const nameWidth = Math.min(Math.max(...allNames.map((n) => n.length), 6), 14);
    const padName = (n: string) => {
      const t = n.length > nameWidth ? n.slice(0, nameWidth - 1) + "…" : n;
      return t.padEnd(nameWidth);
    };
    const padAmt = (s: string, w = 8) => s.padStart(w);

    let msg = `${isMatch ? "⚽" : "📅"} *${ev.name}*\n`;
    msg += `📅 ${formatDate(ev.date)}\n`;
    msg += `💰 Fee: ${formatAED(ev.perHeadFee)}/head · 👥 ${ev.playerCount} players\n\n`;

    // PAID table — show actual paid + extra column
    if (ev.paidMembers.length > 0) {
      msg += `✅ *Paid (${ev.paidCount})*\n`;
      msg += "```\n";
      msg += `${"PLAYER".padEnd(nameWidth)}${padAmt("PAID")}${padAmt("EXTRA", 9)}\n`;
      msg += `${"─".repeat(nameWidth + 8 + 9)}\n`;
      for (const m of ev.paidMembers) {
        const diff = m.paidAmount - m.amount;
        let extraCol = "—";
        if (diff > 0.01) extraCol = `+${num(diff)}`;
        else if (diff < -0.01) extraCol = `cr ${num(Math.abs(diff))}`;
        msg += `${padName(m.name)}${padAmt(num(m.paidAmount))}${padAmt(extraCol, 9)}\n`;
      }
      msg += "```\n\n";
    }

    // UNPAID list
    if (ev.unpaidMembers.length > 0) {
      msg += `❌ *Unpaid (${ev.unpaidCount})*\n`;
      ev.unpaidMembers.forEach((m) => { msg += `• ${m.name} — ${formatAED(m.amount)}\n`; });
      msg += `\n`;
    }

    // Method breakdown: cash / bank / credit applied
    let cashTotal = 0;
    let bankTotal = 0;
    let creditApplied = 0;
    for (const m of ev.paidMembers) {
      if (m.method === "credit") creditApplied += m.amount; // credit covers the fee
      else if (m.method === "bank_transfer") bankTotal += m.paidAmount;
      else cashTotal += m.paidAmount;
    }

    // Day Summary block (always shown for matches)
    if (isMatch) {
      msg += `📊 *Day Summary*\n`;
      msg += "```\n";
      msg += `Cash         ${padAmt(num(cashTotal), 10)}\n`;
      msg += `Bank         ${padAmt(num(bankTotal), 10)}\n`;
      if (creditApplied > 0.01) {
        msg += `Credit Used  ${padAmt(num(creditApplied), 10)}\n`;
      }
      msg += `${"─".repeat(22)}\n`;
      msg += `Collected    ${padAmt(num(ev.totalPaid), 10)}\n`;
      if (ev.totalCost > 0) {
        const surplus = ev.totalPaid - ev.totalCost;
        msg += `Ground       ${padAmt(num(ev.totalCost), 10)}\n`;
        msg += `${surplus >= 0 ? "Surplus     " : "Deficit     "} ${padAmt(num(Math.abs(surplus)), 10)}\n`;
      }
      msg += "```\n";
    }

    // P&L Summary block (only for events with income/expenses, less common for matches)
    const hasFinancials = ev.totalIncome > 0 || ev.totalExpenses > 0 || (!isMatch && ev.totalCost > 0);
    if (hasFinancials) {
      msg += `\n📊 *P&L Summary*\n`;
      msg += "```\n";
      msg += `Contributions ${padAmt(num(ev.totalPaid), 10)}\n`;
      if (ev.totalIncome > 0) msg += `Income        ${padAmt(num(ev.totalIncome), 10)}\n`;
      if (ev.totalExpenses > 0) msg += `Expenses      ${padAmt(num(ev.totalExpenses), 10)}\n`;
      if (ev.totalCost > 0) msg += `Ground Cost   ${padAmt(num(ev.totalCost), 10)}\n`;
      msg += `${"─".repeat(24)}\n`;
      msg += `Net P&L       ${padAmt((ev.netPL >= 0 ? "+" : "-") + num(Math.abs(ev.netPL)), 10)}\n`;
      msg += "```\n";
    }

    if (ev.unpaidMembers.length > 0) {
      msg += `\n_Please clear your dues at the earliest._`;
    }
    shareText(msg);
  }

  // WhatsApp share for outstanding balances
  function shareOutstandingWhatsApp() {
    const totalOutstanding = outstandingReport.reduce((s, m) => s + m.balance, 0);
    const title = profile === "dadas" ? "Outstanding Balances" : "Outstanding Purchase Dues";
    const num = (n: number) => n.toFixed(2);

    const nameWidth = Math.min(Math.max(...outstandingReport.map((m) => m.name.length), 6), 14);
    const padName = (n: string) => {
      const t = n.length > nameWidth ? n.slice(0, nameWidth - 1) + "…" : n;
      return t.padEnd(nameWidth);
    };
    const padAmt = (s: string, w = 9) => s.padStart(w);

    let msg = `🔴 *${title}*\n`;
    msg += `👥 ${outstandingReport.length} member${outstandingReport.length !== 1 ? "s" : ""} owe *${formatAED(totalOutstanding)}*\n\n`;

    msg += "```\n";
    msg += `#  ${"PLAYER".padEnd(nameWidth)}${padAmt("AMOUNT")}\n`;
    msg += `${"─".repeat(3 + nameWidth + 9)}\n`;
    outstandingReport.forEach((m, i) => {
      const idx = String(i + 1).padStart(2, " ") + " ";
      msg += `${idx}${padName(m.name)}${padAmt(num(m.balance))}\n`;
    });
    msg += `${"─".repeat(3 + nameWidth + 9)}\n`;
    msg += `${"   "}${"TOTAL".padEnd(nameWidth)}${padAmt(num(totalOutstanding))}\n`;
    msg += "```\n";
    msg += `\n_Please clear your dues at the earliest._`;
    shareText(msg);
  }

  const totalOutstanding = outstandingReport.reduce((s, m) => s + m.balance, 0);
  const isDadas = profile === "dadas";

  // Events with financial activity (income or expenses)
  const eventsWithPL = eventReports.filter((ev) => ev.totalIncome > 0 || ev.totalExpenses > 0 || ev.totalCost > 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isDadas ? "Reports" : "Big Ticket Reports"}
      </h1>

      {/* Tab Switcher - only show for DADAS */}
      {isDadas && (
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
          <button onClick={() => setTab("events")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === "events" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}>
            Event Collection & P&L
          </button>
          <button onClick={() => setTab("outstanding")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === "outstanding" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}>
            Outstanding Balances
          </button>
        </div>
      )}

      {/* ========== EVENT COLLECTION & P&L REPORT (DADAS only) ========== */}
      {isDadas && tab === "events" && (
        <div className="space-y-4">
          {eventReports.map((ev) => {
            const isExpanded = expandedEvent === ev.id;
            const hasPL = ev.totalIncome > 0 || ev.totalExpenses > 0 || ev.totalCost > 0;
            return (
              <div key={ev.id} className={`bg-white rounded-xl shadow-sm border ${ev.type === "match" ? "border-l-4 border-l-blue-500" : ""}`}>
                <div className="px-4 md:px-6 py-3 md:py-4 cursor-pointer" onClick={() => setExpandedEvent(isExpanded ? null : ev.id)}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900">{ev.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ev.type === "match" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"}`}>{ev.type === "match" ? "Match" : "Event"}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ev.unpaidCount === 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{ev.paidCount}/{ev.playerCount} paid</span>
                        {hasPL && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ev.netPL >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            P&L: {ev.netPL >= 0 ? "+" : ""}{formatAED(ev.netPL)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 mt-1">{formatDate(ev.date)} — {formatAED(ev.perHeadFee)}/head — {ev.playerCount} members</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className="text-sm font-bold text-gray-900">{formatAED(ev.totalPaid)}</div>
                        <div className="text-xs text-gray-600">of {formatAED(ev.totalDue)}</div>
                      </div>
                      <span className="text-gray-400 text-sm">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 md:px-6 py-4 border-t space-y-4">
                    {/* Collection summary */}
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="bg-gray-50 rounded-lg p-3"><span className="text-gray-600">Total Due</span><div className="font-bold text-gray-900">{formatAED(ev.totalDue)}</div></div>
                      <div className="bg-emerald-50 rounded-lg p-3"><span className="text-gray-600">Collected</span><div className="font-bold text-emerald-700">{formatAED(ev.totalPaid)}</div></div>
                      <div className="bg-red-50 rounded-lg p-3"><span className="text-gray-600">Outstanding</span><div className="font-bold text-red-600">{formatAED(ev.outstanding)}</div></div>
                    </div>

                    {/* P&L Section */}
                    {hasPL && (
                      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                        <h4 className="font-bold text-gray-900 text-sm">Profit & Loss</h4>

                        {/* Revenue */}
                        <div>
                          <div className="text-xs font-semibold text-emerald-700 mb-1 uppercase tracking-wide">Revenue</div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-700">Member Contributions</span>
                              <span className="font-semibold text-emerald-700">{formatAED(ev.totalPaid)}</span>
                            </div>
                            {ev.incomes.map((inc, i) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="text-gray-700">
                                  {inc.description}
                                  <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">{incomeCatLabel(inc.category)}</span>
                                </span>
                                <span className="font-semibold text-emerald-700">{formatAED(inc.amount)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between text-sm font-bold border-t border-emerald-200 pt-1 mt-1">
                              <span className="text-emerald-800">Total Revenue</span>
                              <span className="text-emerald-800">{formatAED(ev.totalRevenue)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Costs */}
                        <div>
                          <div className="text-xs font-semibold text-red-700 mb-1 uppercase tracking-wide">Costs</div>
                          <div className="space-y-1">
                            {ev.totalCost > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-700">Event Cost (Ground/Venue)</span>
                                <span className="font-semibold text-red-600">{formatAED(ev.totalCost)}</span>
                              </div>
                            )}
                            {ev.expenses.map((exp, i) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="text-gray-700">
                                  {exp.description}
                                  <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">{expenseCatLabel(exp.category)}</span>
                                </span>
                                <span className="font-semibold text-red-600">{formatAED(exp.amount)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between text-sm font-bold border-t border-red-200 pt-1 mt-1">
                              <span className="text-red-800">Total Costs</span>
                              <span className="text-red-800">{formatAED(ev.totalCosts)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Net P&L */}
                        <div className={`flex justify-between items-center rounded-lg p-3 ${ev.netPL >= 0 ? "bg-emerald-100" : "bg-red-100"}`}>
                          <span className={`font-bold text-sm ${ev.netPL >= 0 ? "text-emerald-800" : "text-red-800"}`}>Net Profit/Loss</span>
                          <span className={`font-bold text-lg ${ev.netPL >= 0 ? "text-emerald-800" : "text-red-800"}`}>
                            {ev.netPL >= 0 ? "+" : ""}{formatAED(ev.netPL)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Paid Members */}
                    {ev.paidMembers.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-emerald-700 mb-1">Paid ({ev.paidCount})</h4>
                        <div className="space-y-1">{ev.paidMembers.map((m, i) => (
                          <div key={i} className="flex justify-between items-center bg-emerald-50 rounded-lg px-3 py-1.5 text-sm">
                            <span className="text-gray-900 font-medium">{m.name}{m.isGuest ? " (guest)" : ""}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${m.method === "bank_transfer" ? "bg-blue-100 text-blue-700" : m.method === "company_contribution" ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"}`}>
                                {m.method === "bank_transfer" ? "Bank" : m.method === "company_contribution" ? "Company" : "Cash"}
                              </span>
                              <span className="font-semibold text-emerald-700">{formatAED(m.paidAmount)}</span>
                              {m.paidAmount !== m.amount && <span className="text-xs text-gray-500">(due: {formatAED(m.amount)})</span>}
                            </div>
                          </div>
                        ))}</div>
                      </div>
                    )}
                    {ev.unpaidMembers.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-red-600 mb-1">Unpaid ({ev.unpaidCount})</h4>
                        <div className="space-y-1">{ev.unpaidMembers.map((m, i) => (
                          <div key={i} className="flex justify-between bg-red-50 rounded-lg px-3 py-1.5 text-sm">
                            <span className="text-gray-900 font-medium">{m.name}{m.isGuest ? " (guest)" : ""}</span>
                            <span className="font-semibold text-red-600">{formatAED(m.amount)}</span>
                          </div>
                        ))}</div>
                      </div>
                    )}

                    <button onClick={() => shareEventWhatsApp(ev)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 w-full sm:w-auto">
                      Share via WhatsApp
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {eventReports.length === 0 && <div className="text-center text-gray-600 py-12 font-medium">No events yet.</div>}
        </div>
      )}

      {/* ========== OUTSTANDING BALANCES REPORT ========== */}
      {(isDadas ? tab === "outstanding" : true) && (
        <div>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <div className="text-sm font-semibold text-red-700">Total Outstanding</div>
              <div className="text-2xl font-bold text-red-700 mt-1">{formatAED(totalOutstanding)}</div>
            </div>
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <div className="text-sm font-semibold text-amber-700">Members with Dues</div>
              <div className="text-2xl font-bold text-amber-700 mt-1">{outstandingReport.length}</div>
            </div>
          </div>

          {/* Share Button */}
          {outstandingReport.length > 0 && (
            <button onClick={shareOutstandingWhatsApp} className="bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 mb-4 w-full sm:w-auto">
              {isDadas ? "Share Outstanding Report via WhatsApp" : "Share Purchase Dues via WhatsApp"}
            </button>
          )}

          {/* Members List */}
          <div className="bg-white rounded-xl shadow-sm border">
            {/* Mobile */}
            <div className="md:hidden divide-y">
              {outstandingReport.map((m, i) => (
                <div key={m.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-500 mr-2">{i + 1}.</span>
                      <span className="font-semibold text-gray-900">{m.name}</span>
                    </div>
                    <span className="font-bold text-red-600">{formatAED(m.balance)}</span>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-gray-700">
                    <span>Due: {formatAED(m.totalDue)}</span>
                    <span>Paid: {formatAED(m.totalPaid)}</span>
                  </div>
                </div>
              ))}
              {outstandingReport.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-600 font-medium">
                  {isDadas ? "No outstanding balances. All settled!" : "No outstanding purchase dues. All settled!"}
                </div>
              )}
            </div>

            {/* Desktop */}
            <table className="w-full hidden md:table">
              <thead>
                <tr className="text-left text-sm text-gray-700 border-b bg-gray-50">
                  <th className="px-6 py-3 font-semibold w-10">#</th>
                  <th className="px-6 py-3 font-semibold">Member</th>
                  <th className="px-6 py-3 font-semibold">Phone</th>
                  <th className="px-6 py-3 font-semibold text-right">Total Due</th>
                  <th className="px-6 py-3 font-semibold text-right">Paid</th>
                  <th className="px-6 py-3 font-semibold text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {outstandingReport.map((m, i) => (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-600">{i + 1}</td>
                    <td className="px-6 py-3 font-semibold text-gray-900">{m.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-800">{m.phone || "-"}</td>
                    <td className="px-6 py-3 text-right text-sm text-gray-800">{formatAED(m.totalDue)}</td>
                    <td className="px-6 py-3 text-right text-sm text-emerald-700 font-medium">{formatAED(m.totalPaid)}</td>
                    <td className="px-6 py-3 text-right text-sm font-bold text-red-600">{formatAED(m.balance)}</td>
                  </tr>
                ))}
                {outstandingReport.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-600 font-medium">
                    {isDadas ? "No outstanding balances. All settled!" : "No outstanding purchase dues. All settled!"}
                  </td></tr>
                )}
              </tbody>
              {outstandingReport.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 border-t">
                    <td colSpan={5} className="px-6 py-3 text-right font-bold text-gray-900">Total Outstanding</td>
                    <td className="px-6 py-3 text-right font-bold text-red-600 text-lg">{formatAED(totalOutstanding)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
