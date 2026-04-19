"use client";

import { useEffect, useState } from "react";

interface MemberGroup { id: string; name: string; members: { id: string; member: { id: string; name: string } }[] }
interface EventTemplate { id: string; name: string; type: string; amount: number; amountType: string; groupId: string | null; notes: string }

export default function SettingsPage() {
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [iban, setIban] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [swiftCode, setSwiftCode] = useState("");
  const [defaultMatchFee, setDefaultMatchFee] = useState("20");
  const [defaultBigTicketShare, setDefaultBigTicketShare] = useState("50");
  const [groupName, setGroupName] = useState("Company");
  const [autoDeleteDays, setAutoDeleteDays] = useState("0");
  const [saved, setSaved] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplType, setTplType] = useState("event");
  const [tplAmount, setTplAmount] = useState("");
  const [tplAmountType, setTplAmountType] = useState("total");
  const [tplGroupId, setTplGroupId] = useState("");
  const [tplNotes, setTplNotes] = useState("");
  const [tplSubmitting, setTplSubmitting] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const data = await (await fetch("/api/settings/data")).json();
    const s = data.settings;
    setBankName(s.bankName); setAccountName(s.accountName); setIban(s.iban);
    setAccountNumber(s.accountNumber); setSwiftCode(s.swiftCode);
    setDefaultMatchFee(String(s.defaultMatchFee || 20));
    setDefaultBigTicketShare(String(s.defaultBigTicketShare || 50));
    setGroupName(s.groupName || "Company");
    setAutoDeleteDays(String(s.autoDeleteDays || 0));
    setTemplates(data.templates);
    setGroups(data.groups);
    setLoading(false);
  }
  function loadTemplates() { loadAll(); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); if (savingSettings) return; setSavingSettings(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankName, accountName, iban, accountNumber, swiftCode,
          defaultMatchFee: parseFloat(defaultMatchFee),
          defaultBigTicketShare: parseFloat(defaultBigTicketShare) || 50,
          groupName,
          autoDeleteDays: parseInt(autoDeleteDays) || 0,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSavingSettings(false); }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault(); if (savingPassword) return;
    setPwMsg(""); setPwError(false);

    if (newPassword !== confirmPassword) {
      setPwMsg("New passwords do not match");
      setPwError(true);
      return;
    }
    if (newPassword.length < 6) {
      setPwMsg("Password must be at least 6 characters");
      setPwError(true);
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        setPwMsg("Password changed successfully!");
        setPwError(false);
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      } else {
        setPwMsg(data.error || "Failed to change password");
        setPwError(true);
      }
    } finally { setSavingPassword(false); }
  }

  // --- Templates ---
  function openTemplateForm(tpl?: EventTemplate) {
    if (tpl) {
      setEditingTemplateId(tpl.id);
      setTplName(tpl.name);
      setTplType(tpl.type);
      setTplAmount(String(tpl.amount || ""));
      setTplAmountType(tpl.amountType);
      setTplGroupId(tpl.groupId || "");
      setTplNotes(tpl.notes);
    } else {
      setEditingTemplateId(null);
      setTplName(""); setTplType("event"); setTplAmount(""); setTplAmountType("total"); setTplGroupId(""); setTplNotes("");
    }
    setShowTemplateForm(true);
  }

  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault(); if (tplSubmitting || !tplName.trim()) return; setTplSubmitting(true);
    try {
      const payload = { name: tplName, type: tplType, amount: tplAmount, amountType: tplAmountType, groupId: tplGroupId || null, notes: tplNotes };
      if (editingTemplateId) {
        await fetch(`/api/templates/${editingTemplateId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      setShowTemplateForm(false); setEditingTemplateId(null);
      loadTemplates();
    } finally { setTplSubmitting(false); }
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    loadTemplates();
  }

  function getGroupName(groupId: string | null) {
    if (!groupId) return "All Members";
    return groups.find((g) => g.id === groupId)?.name || "Unknown Group";
  }

  if (loading) return <div className="text-gray-700 font-medium p-4">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Quick Event Templates */}
      <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 max-w-2xl mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">Quick Event Templates</h2>
            <p className="text-sm text-gray-700 mt-1">Create templates for recurring events. Use them in the Events page to create events with one tap.</p>
          </div>
          <button onClick={() => { if (showTemplateForm && !editingTemplateId) setShowTemplateForm(false); else openTemplateForm(); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm flex-shrink-0">
            {showTemplateForm && !editingTemplateId ? "Cancel" : "New Template"}
          </button>
        </div>

        {showTemplateForm && (
          <form onSubmit={handleSaveTemplate} className="bg-blue-50 rounded-lg border border-blue-200 p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Template Name</label>
                <input type="text" value={tplName} onChange={(e) => setTplName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" placeholder="e.g. Monthly Big Ticket" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Type</label>
                <select value={tplType} onChange={(e) => setTplType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900">
                  <option value="event">Event (split cost)</option>
                  <option value="match">Match (per-head fee)</option>
                  <option value="purchase">Purchase (Big Ticket)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Default Amount (AED)</label>
                <input type="number" step="0.01" value={tplAmount} onChange={(e) => setTplAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" placeholder="0 = ask each time" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Amount Means</label>
                <select value={tplAmountType} onChange={(e) => setTplAmountType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900">
                  <option value="total">Total Cost (split equally)</option>
                  <option value="perhead">Per Head Fee</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Assign to Group</label>
              <select value={tplGroupId} onChange={(e) => setTplGroupId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900">
                <option value="">All Active Members</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.members.length} members)</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Default Notes</label>
              <input type="text" value={tplNotes} onChange={(e) => setTplNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" placeholder="Optional" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={tplSubmitting}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm">
                {tplSubmitting ? "Saving..." : editingTemplateId ? "Update Template" : "Create Template"}
              </button>
              {editingTemplateId && (
                <button type="button" onClick={() => { setShowTemplateForm(false); setEditingTemplateId(null); }}
                  className="px-4 py-2 text-gray-700 font-medium text-sm">Cancel</button>
              )}
            </div>
          </form>
        )}

        {templates.length > 0 ? (
          <div className="space-y-2">
            {templates.map((tpl) => (
              <div key={tpl.id} className="bg-gray-50 rounded-lg px-4 py-3 border flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{tpl.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tpl.type === "match" ? "bg-blue-100 text-blue-800" : tpl.type === "purchase" ? "bg-purple-100 text-purple-800" : "bg-emerald-100 text-emerald-800"}`}>
                      {tpl.type === "match" ? "Match" : tpl.type === "purchase" ? "Purchase" : "Event"}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700 mt-0.5">
                    {tpl.amount > 0 ? `AED ${tpl.amount} ${tpl.amountType === "total" ? "(total, split equally)" : "(per head)"}` : "Amount: ask each time"}
                    {" · "}{getGroupName(tpl.groupId)}
                    {tpl.notes && ` · ${tpl.notes}`}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openTemplateForm(tpl)} className="text-blue-600 text-xs font-medium hover:underline">Edit</button>
                  <button onClick={() => handleDeleteTemplate(tpl.id)} className="text-red-600 text-xs font-medium hover:underline">Delete</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No templates yet. Create one for recurring events like monthly big-ticket purchases.</p>
        )}
      </div>

      {/* Match & Group Settings */}
      <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 max-w-2xl mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Match & Group Settings</h2>
        <p className="text-sm text-gray-700 mb-6">
          Configure the default fee for weekly football matches and your group name.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Group / Company Name</label>
              <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                placeholder="e.g. Al Dadas FC" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Default Match Fee (AED)</label>
              <input type="number" step="0.01" value={defaultMatchFee} onChange={(e) => setDefaultMatchFee(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                placeholder="20" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Default Big Ticket Share (AED)</label>
              <input type="number" step="0.01" value={defaultBigTicketShare} onChange={(e) => setDefaultBigTicketShare(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                placeholder="50" />
              <p className="text-xs text-gray-600 mt-1">Per member share for Big Ticket purchases</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Auto-Delete Settled Matches</label>
              <select value={autoDeleteDays} onChange={(e) => setAutoDeleteDays(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900">
                <option value="0">Disabled</option>
                <option value="3">After 3 days</option>
                <option value="7">After 7 days</option>
                <option value="14">After 14 days</option>
                <option value="30">After 30 days</option>
                <option value="60">After 60 days</option>
                <option value="90">After 90 days</option>
              </select>
              <p className="text-xs text-gray-600 mt-1">Auto-delete matches where all players have paid</p>
            </div>
          </div>

          <hr className="my-6" />

          <h2 className="font-semibold text-gray-900 mb-4">Bank Details</h2>
          <p className="text-sm text-gray-700 mb-4">Displayed to members for bank transfers.</p>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Bank Name</label>
            <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
              placeholder="e.g. Emirates NBD" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Account Name</label>
            <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
              placeholder="Account holder name" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">IBAN</label>
            <input type="text" value={iban} onChange={(e) => setIban(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-gray-900"
              placeholder="AE..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Account Number</label>
              <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">SWIFT Code</label>
              <input type="text" value={swiftCode} onChange={(e) => setSwiftCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-gray-900" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={savingSettings} className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-700 font-semibold disabled:opacity-50">
              {savingSettings ? "Saving..." : "Save All Settings"}
            </button>
            {saved && <span className="text-sm text-emerald-600 font-semibold">Saved!</span>}
          </div>
        </form>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 max-w-2xl">
        <h2 className="font-semibold text-gray-900 mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Current Password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
              required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
              required minLength={6} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
              required minLength={6} />
          </div>
          {pwMsg && (
            <p className={`text-sm font-semibold ${pwError ? "text-red-600" : "text-emerald-600"}`}>{pwMsg}</p>
          )}
          <button type="submit" disabled={savingPassword} className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-700 font-semibold disabled:opacity-50">
            {savingPassword ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
