"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatAED } from "@/lib/format";
import { useProfile } from "@/lib/profile-context";

interface MemberBalance {
  id: string;
  name: string;
  phone: string;
  totalDue: number;
  totalPaid: number;
  balance: number;
}

interface DadasTotals {
  totalReceived: number;
  totalCosts: number;
  totalIncome: number;
  totalOutstanding: number;
  groupFund: number;
  memberCount: number;
  groupName: string;
}

interface BigTicketTotals {
  totalPurchases: number;
  totalOutstanding: number;
  totalCollected: number;
  memberCount: number;
  groupName: string;
}

interface DashboardData {
  profile: string;
  balances: MemberBalance[];
  totals: DadasTotals & BigTicketTotals;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [balanceFilter, setBalanceFilter] = useState<"all" | "dues" | "settled" | "credits">("all");
  const router = useRouter();
  const { profile } = useProfile();

  useEffect(() => {
    const ctrl = new AbortController();
    setData(null);
    setBalanceFilter("all");
    fetch(`/api/dashboard?profile=${profile}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => { if (d.profile === profile) setData(d); })
      .catch((e) => { if (e.name !== "AbortError") console.error(e); });
    return () => ctrl.abort();
  }, [profile]);

  if (!data || data.profile !== profile) return <div className="text-gray-700 font-medium p-4">Loading...</div>;

  const { balances, totals } = data;

  const owingMembers = balances.filter((b) => b.balance > 0);
  const creditMembers = balances.filter((b) => b.balance < 0);
  const settledMembers = balances.filter((b) => b.balance === 0 && (b.totalDue > 0 || b.totalPaid > 0));

  const filteredBalances = balanceFilter === "dues" ? owingMembers
    : balanceFilter === "credits" ? creditMembers
    : balanceFilter === "settled" ? settledMembers
    : balances;

  async function shareText(text: string) {
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(text); alert("Copied to clipboard!"); } catch { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank"); }
  }

  const isDadas = profile === "dadas";

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isDadas ? "Dashboard" : "Big Ticket Dashboard"}
      </h1>

      {/* Summary Cards */}
      {isDadas ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
          <Card label="Total Received" value={formatAED(totals.totalReceived)} color="emerald" onClick={() => router.push("/payments")} />
          <Card label="Total Costs" value={formatAED(totals.totalCosts)} color="red" onClick={() => router.push("/expenses")} />
          <Card label="Total Income" value={formatAED(totals.totalIncome)} color="purple" onClick={() => router.push("/income")} />
          <Card label="Outstanding" value={formatAED(totals.totalOutstanding)} color={totals.totalOutstanding > 0 ? "amber" : "emerald"} onClick={() => router.push("/reports?tab=outstanding")} />
          <Card
            label={`${totals.groupName} Fund`}
            value={formatAED(totals.groupFund)}
            color={totals.groupFund >= 0 ? "emerald" : "red"}
            subtitle={totals.groupFund >= 0 ? "Surplus" : "Deficit"}
            onClick={() => router.push("/reports?tab=events")}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
          <Card label="Total Purchases" value={formatAED(totals.totalPurchases)} color="purple" onClick={() => router.push("/purchases")} />
          <Card label="Collected" value={formatAED(totals.totalCollected)} color="emerald" />
          <Card label="Outstanding" value={formatAED(totals.totalOutstanding)} color={totals.totalOutstanding > 0 ? "amber" : "emerald"} onClick={() => router.push("/reports?tab=outstanding")} />
        </div>
      )}

      {/* Outstanding Members */}
      {owingMembers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-red-200 mb-6 md:mb-8">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-red-100 bg-red-50 rounded-t-xl flex items-center justify-between">
            <div className="cursor-pointer" onClick={() => router.push("/reports?tab=outstanding")}>
              <h2 className="font-bold text-red-700">
                {isDadas ? "Outstanding Dues" : "Outstanding Purchase Dues"}
              </h2>
              <p className="text-sm text-red-600">{owingMembers.length} member{owingMembers.length !== 1 ? "s" : ""} owe {formatAED(totals.totalOutstanding)}</p>
            </div>
            <button onClick={() => {
              const title = isDadas ? "Outstanding Dues Report" : "Outstanding Purchase Dues";
              let msg = `*${title}*\n`;
              msg += `Total: ${formatAED(totals.totalOutstanding)}\n\n`;
              owingMembers.sort((a, b) => b.balance - a.balance).forEach((m, i) => { msg += `${i + 1}. ${m.name} - ${formatAED(m.balance)}\n`; });
              msg += `\n_Please clear your dues at the earliest._`;
              shareText(msg);
            }} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-700 flex-shrink-0">
              Share
            </button>
          </div>
          <div className="divide-y">
            {owingMembers.sort((a, b) => b.balance - a.balance).map((m, i) => (
              <div key={m.id} className="px-4 md:px-6 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-5">{i + 1}.</span>
                  <span className="font-semibold text-gray-900 text-sm">{m.name}</span>
                </div>
                <span className="font-bold text-red-600 text-sm">{formatAED(m.balance)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Balance Table */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-4 md:px-6 py-3 md:py-4 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-gray-900">
                {isDadas ? "All Member Balances" : "Purchase Split Balances"}
              </h2>
              <p className="text-sm text-gray-700">{totals.memberCount} active members</p>
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {([["all", "All"], ["dues", "Dues"], ["settled", "Settled"], ["credits", "Credits"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setBalanceFilter(key)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${balanceFilter === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}>{label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {/* Mobile card view */}
          <div className="md:hidden divide-y">
            {filteredBalances.map((m) => (
              <div key={m.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-gray-900">{m.name}</div>
                  {m.balance > 0 ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">Owes</span>
                  ) : m.balance < 0 ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Credit</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold">Settled</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                  <div><span className="text-gray-600">Due</span><div className="font-semibold text-gray-900">{formatAED(m.totalDue)}</div></div>
                  <div><span className="text-gray-600">Paid</span><div className="font-semibold text-emerald-700">{formatAED(m.totalPaid)}</div></div>
                  <div><span className="text-gray-600">Balance</span><div className={`font-bold ${m.balance > 0 ? "text-red-600" : m.balance < 0 ? "text-emerald-600" : "text-gray-500"}`}>
                    {m.balance > 0 ? formatAED(m.balance) : m.balance < 0 ? `-${formatAED(Math.abs(m.balance))}` : formatAED(0)}
                  </div></div>
                </div>
              </div>
            ))}
            {filteredBalances.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-600 font-medium">{balanceFilter === "all" ? "No members yet." : "No members in this category."}</div>
            )}
          </div>

          {/* Desktop table view */}
          <table className="w-full hidden md:table">
            <thead>
              <tr className="text-left text-sm text-gray-700 border-b">
                <th className="px-6 py-3 font-semibold">Member</th>
                <th className="px-6 py-3 font-semibold text-right">Total Due</th>
                <th className="px-6 py-3 font-semibold text-right">Paid</th>
                <th className="px-6 py-3 font-semibold text-right">Balance</th>
                <th className="px-6 py-3 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredBalances.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <div className="font-semibold text-gray-900">{m.name}</div>
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-semibold text-gray-900">{formatAED(m.totalDue)}</td>
                  <td className="px-6 py-3 text-right text-sm text-emerald-700 font-semibold">{formatAED(m.totalPaid)}</td>
                  <td className={`px-6 py-3 text-right text-sm font-bold ${m.balance > 0 ? "text-red-600" : m.balance < 0 ? "text-emerald-600" : "text-gray-500"}`}>
                    {m.balance > 0 ? formatAED(m.balance) : m.balance < 0 ? `-${formatAED(Math.abs(m.balance))}` : formatAED(0)}
                  </td>
                  <td className="px-6 py-3 text-center">
                    {m.balance > 0 ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-semibold">Owes</span>
                    ) : m.balance < 0 ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Credit</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-semibold">Settled</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredBalances.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-600 font-medium">{balanceFilter === "all" ? "No members yet. Add members to get started." : "No members in this category."}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {balances.length > 0 && (
          <div className="px-4 md:px-6 py-3 md:py-4 bg-gray-50 border-t flex flex-wrap gap-4 md:gap-6 text-sm">
            {owingMembers.length > 0 && (
              <div className="text-red-600 font-medium"><span className="font-bold">{owingMembers.length}</span> owe money</div>
            )}
            {creditMembers.length > 0 && (
              <div className="text-emerald-600 font-medium"><span className="font-bold">{creditMembers.length}</span> have credit</div>
            )}
            {settledMembers.length > 0 && (
              <div className="text-gray-600 font-medium"><span className="font-bold">{settledMembers.length}</span> settled</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, color, subtitle, onClick }: { label: string; value: string; color: string; subtitle?: string; onClick?: () => void }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-700 border-red-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return (
    <div onClick={onClick} className={`rounded-xl border p-3 md:p-5 ${colors[color]} ${onClick ? "cursor-pointer hover:shadow-md active:scale-[0.98] transition-all" : ""}`}>
      <div className="text-xs md:text-sm font-semibold opacity-80">{label}</div>
      <div className="text-lg md:text-2xl font-bold mt-1">{value}</div>
      {subtitle && <div className="text-xs opacity-70 mt-1">{subtitle}</div>}
    </div>
  );
}
