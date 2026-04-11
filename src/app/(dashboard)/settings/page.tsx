"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [iban, setIban] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [swiftCode, setSwiftCode] = useState("");
  const [defaultMatchFee, setDefaultMatchFee] = useState("20");
  const [groupName, setGroupName] = useState("Company");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((s) => {
      setBankName(s.bankName);
      setAccountName(s.accountName);
      setIban(s.iban);
      setAccountNumber(s.accountNumber);
      setSwiftCode(s.swiftCode);
      setDefaultMatchFee(String(s.defaultMatchFee || 20));
      setGroupName(s.groupName || "Company");
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankName,
        accountName,
        iban,
        accountNumber,
        swiftCode,
        defaultMatchFee: parseFloat(defaultMatchFee),
        groupName,
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Match & Group Settings */}
      <div className="bg-white rounded-xl shadow-sm border p-6 max-w-2xl mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Match & Group Settings</h2>
        <p className="text-sm text-gray-500 mb-6">
          Configure the default fee for weekly football matches and your group name.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group / Company Name</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g. Al Dadas FC"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Match Fee (AED)</label>
              <input
                type="number"
                step="0.01"
                value={defaultMatchFee}
                onChange={(e) => setDefaultMatchFee(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="20"
              />
            </div>
          </div>

          <hr className="my-6" />

          <h2 className="font-semibold text-gray-900 mb-4">Bank Details</h2>
          <p className="text-sm text-gray-500 mb-4">
            Displayed to members for bank transfers.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="e.g. Emirates NBD"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Account holder name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
            <input
              type="text"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
              placeholder="AE..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SWIFT Code</label>
              <input
                type="text"
                value={swiftCode}
                onChange={(e) => setSwiftCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 font-medium"
            >
              Save All Settings
            </button>
            {saved && <span className="text-sm text-emerald-600">Saved!</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
