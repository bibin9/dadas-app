"use client";

import { useEffect, useState } from "react";
import { formatAED } from "@/lib/format";

interface MemberBalance {
  id: string;
  name: string;
  phone: string;
  totalEventDues: number;
  totalPurchaseSplits: number;
  totalDue: number;
  totalPaid: number;
  balance: number;
}

interface DashboardData {
  balances: MemberBalance[];
  totals: {
    totalDue: number;
    totalPaid: number;
    totalOutstanding: number;
    totalCredit: number;
    memberCount: number;
    groupFund: number;
    totalEventCosts: number;
    totalPurchaseCosts: number;
    groupName: string;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <div className="text-gray-500">Loading...</div>;

  const { balances, totals } = data;

  // Separate members into those who owe and those with credit
  const owingMembers = balances.filter((b) => b.balance > 0);
  const creditMembers = balances.filter((b) => b.balance < 0);
  const settledMembers = balances.filter((b) => b.balance === 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Summary Cards - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card label="Total Members" value={String(totals.memberCount)} color="blue" />
        <Card label="Total Collected" value={formatAED(totals.totalPaid)} color="emerald" />
        <Card label="Outstanding" value={formatAED(totals.totalOutstanding)} color="red" />
        <Card
          label={`${totals.groupName} Fund`}
          value={formatAED(totals.groupFund)}
          color={totals.groupFund >= 0 ? "emerald" : "red"}
          subtitle={totals.groupFund >= 0 ? "Surplus" : "Deficit"}
        />
      </div>

      {/* Summary Cards - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card label="Total Dues Charged" value={formatAED(totals.totalDue)} color="amber" />
        <Card label="Advance Credits" value={formatAED(totals.totalCredit)} color="purple" subtitle={`${creditMembers.length} member${creditMembers.length !== 1 ? "s" : ""} with credit`} />
        <Card label="Event & Purchase Costs" value={formatAED(totals.totalEventCosts + totals.totalPurchaseCosts)} color="gray" />
      </div>

      {/* Balance Table */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Member Balances</h2>
          <p className="text-sm text-gray-500">
            Positive = owes money | Negative = advance credit
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="px-6 py-3 font-medium">Member</th>
                <th className="px-6 py-3 font-medium text-right">Event Dues</th>
                <th className="px-6 py-3 font-medium text-right">Purchase Splits</th>
                <th className="px-6 py-3 font-medium text-right">Total Due</th>
                <th className="px-6 py-3 font-medium text-right">Paid</th>
                <th className="px-6 py-3 font-medium text-right">Balance</th>
                <th className="px-6 py-3 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <div className="font-medium text-gray-900">{m.name}</div>
                    {m.phone && <div className="text-sm text-gray-500">{m.phone}</div>}
                  </td>
                  <td className="px-6 py-3 text-right text-sm">{formatAED(m.totalEventDues)}</td>
                  <td className="px-6 py-3 text-right text-sm">{formatAED(m.totalPurchaseSplits)}</td>
                  <td className="px-6 py-3 text-right text-sm font-medium">{formatAED(m.totalDue)}</td>
                  <td className="px-6 py-3 text-right text-sm text-emerald-600 font-medium">{formatAED(m.totalPaid)}</td>
                  <td className={`px-6 py-3 text-right text-sm font-bold ${
                    m.balance > 0 ? "text-red-600" : m.balance < 0 ? "text-emerald-600" : "text-gray-400"
                  }`}>
                    {m.balance > 0
                      ? formatAED(m.balance)
                      : m.balance < 0
                        ? `-${formatAED(Math.abs(m.balance))}`
                        : formatAED(0)}
                  </td>
                  <td className="px-6 py-3 text-center">
                    {m.balance > 0 ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium">
                        Owes
                      </span>
                    ) : m.balance < 0 ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                        Credit
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
                        Settled
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {balances.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                    No members yet. Add members to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Quick Summary Footer */}
        {balances.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t flex flex-wrap gap-6 text-sm">
            {owingMembers.length > 0 && (
              <div className="text-red-600">
                <span className="font-semibold">{owingMembers.length}</span> member{owingMembers.length !== 1 ? "s" : ""} owe money
              </div>
            )}
            {creditMembers.length > 0 && (
              <div className="text-emerald-600">
                <span className="font-semibold">{creditMembers.length}</span> member{creditMembers.length !== 1 ? "s" : ""} have advance credit
              </div>
            )}
            {settledMembers.length > 0 && (
              <div className="text-gray-500">
                <span className="font-semibold">{settledMembers.length}</span> settled
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, color, subtitle }: { label: string; value: string; color: string; subtitle?: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-700 border-red-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <div className="text-sm font-medium opacity-75">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {subtitle && <div className="text-xs opacity-60 mt-1">{subtitle}</div>}
    </div>
  );
}
