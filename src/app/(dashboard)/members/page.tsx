"use client";

import { useEffect, useState } from "react";
import { useProfile } from "@/lib/profile-context";

interface Member {
  id: string;
  name: string;
  phone: string;
  active: boolean;
}

interface MemberGroupMember { id: string; member: Member }
interface MemberGroup { id: string; name: string; members: MemberGroupMember[] }

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Groups
  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupSubmitting, setGroupSubmitting] = useState(false);

  const [loading, setLoading] = useState(true);
  const { profile } = useProfile();

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/members/data?profile=${profile}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        setMembers(data.members);
        setGroups(data.groups);
        setLoading(false);
      })
      .catch((e) => { if (e.name !== "AbortError") console.error(e); });
    return () => ctrl.abort();
  }, [profile]);

  async function loadAll() {
    const data = await (await fetch(`/api/members/data?profile=${profile}`)).json();
    setMembers(data.members);
    setGroups(data.groups);
    setLoading(false);
  }
  function loadMembers() { loadAll(); }
  function loadGroups() { loadAll(); }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return; setSubmitting(true);
    try {
      await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      setName("");
      setPhone("");
      loadMembers();
    } finally { setSubmitting(false); }
  }

  async function handleUpdate(id: string) {
    await fetch(`/api/members/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, phone: editPhone, active: true }),
    });
    setEditingId(null);
    loadMembers();
  }

  async function handleToggleActive(member: Member) {
    await fetch(`/api/members/${member.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: member.name, phone: member.phone, active: !member.active }),
    });
    loadMembers();
  }

  async function handleDelete(id: string) {
    const m = members.find((x) => x.id === id);
    const msg = m
      ? `⚠️ DELETE member "${m.name}"?\n\nThis will PERMANENTLY remove the member and ALL their:\n• Event dues\n• Purchase shares\n• Payment history\n\nThis cannot be undone.`
      : "Delete this member?";
    if (!confirm(msg)) return;
    await fetch(`/api/members/${id}`, { method: "DELETE" });
    loadMembers();
  }

  // --- Groups ---
  function openGroupForm(group?: MemberGroup) {
    if (group) {
      setEditingGroupId(group.id);
      setGroupName(group.name);
      setGroupMembers(group.members.map((gm) => gm.member.id));
    } else {
      setEditingGroupId(null);
      setGroupName("");
      setGroupMembers([]);
    }
    setShowGroupForm(true);
  }

  async function handleSaveGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!groupName.trim() || groupSubmitting) return; setGroupSubmitting(true);
    try {
      if (editingGroupId) {
        await fetch(`/api/groups/${editingGroupId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: groupName.trim(), memberIds: groupMembers }),
        });
      } else {
        await fetch("/api/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: groupName.trim(), memberIds: groupMembers }),
        });
      }
      setShowGroupForm(false);
      setEditingGroupId(null);
      setGroupName("");
      setGroupMembers([]);
      loadGroups();
    } finally { setGroupSubmitting(false); }
  }

  async function handleDeleteGroup(id: string) {
    const g = groups.find((x) => x.id === id);
    const msg = g
      ? `⚠️ DELETE group "${g.name}"?\n\n${g.members.length} member(s) will be unlinked. The members themselves are NOT deleted.\n\nThis cannot be undone.`
      : "Delete this group?";
    if (!confirm(msg)) return;
    await fetch(`/api/groups/${id}`, { method: "DELETE" });
    loadGroups();
  }

  function toggleGroupMember(id: string) {
    setGroupMembers((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  const activeMembers = members.filter((m) => m.active);

  if (loading) return <div className="text-gray-700 font-medium p-4">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Members</h1>

      {/* Add Member Form */}
      <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Add Member</h2>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-800 mb-1">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
              placeholder="Member name" required />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-800 mb-1">Phone</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
              placeholder="+971..." />
          </div>
          <button type="submit" disabled={submitting} className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-700 font-semibold disabled:opacity-50">
            {submitting ? "Adding..." : "Add"}
          </button>
        </form>
      </div>

      {/* ========== MEMBER GROUPS ========== */}
      <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Member Groups</h2>
          <button onClick={() => { if (showGroupForm && !editingGroupId) setShowGroupForm(false); else openGroupForm(); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm">
            {showGroupForm && !editingGroupId ? "Cancel" : "New Group"}
          </button>
        </div>

        {showGroupForm && (
          <form onSubmit={handleSaveGroup} className="bg-blue-50 rounded-lg border border-blue-200 p-4 mb-4 space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Group Name</label>
              <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" placeholder="e.g. Core Team, Weekend Players" required />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-800">Members ({groupMembers.length})</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setGroupMembers(activeMembers.map((m) => m.id))} className="text-xs text-blue-700 font-medium hover:underline">All</button>
                  <button type="button" onClick={() => setGroupMembers([])} className="text-xs text-gray-600 font-medium hover:underline">None</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeMembers.map((m) => (
                  <label key={m.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm font-medium ${groupMembers.includes(m.id) ? "bg-blue-100 border-blue-400 text-blue-900" : "bg-gray-50 border-gray-300 text-gray-600"}`}>
                    <input type="checkbox" checked={groupMembers.includes(m.id)} onChange={() => toggleGroupMember(m.id)} className="sr-only" />
                    {m.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={groupSubmitting || groupMembers.length === 0}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm">
                {groupSubmitting ? "Saving..." : editingGroupId ? "Update Group" : "Create Group"}
              </button>
              {editingGroupId && (
                <button type="button" onClick={() => { setShowGroupForm(false); setEditingGroupId(null); }}
                  className="px-4 py-2 text-gray-700 font-medium text-sm">Cancel</button>
              )}
            </div>
          </form>
        )}

        {groups.length > 0 ? (
          <div className="space-y-2">
            {groups.map((g) => (
              <div key={g.id} className="bg-gray-50 rounded-lg px-4 py-3 border">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-gray-900">{g.name}</span>
                  <div className="flex gap-2">
                    <button onClick={() => openGroupForm(g)} className="text-blue-600 text-xs font-medium hover:underline">Edit</button>
                    <button onClick={() => handleDeleteGroup(g.id)} className="text-red-600 text-xs font-medium hover:underline">Delete</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {g.members.map((gm) => (
                    <span key={gm.id} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">{gm.member.name}</span>
                  ))}
                  {g.members.length === 0 && <span className="text-xs text-gray-500">No members</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No groups yet. Create groups to quickly assign members to events and purchases.</p>
        )}
      </div>

      {/* Members List - Mobile Cards */}
      <div className="md:hidden space-y-3">
        {members.map((m) => (
          <div key={m.id} className="bg-white rounded-xl shadow-sm border p-4">
            {editingId === m.id ? (
              <div className="space-y-3">
                <input value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900" placeholder="Name" />
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-gray-900" placeholder="Phone" />
                <div className="flex gap-2">
                  <button onClick={() => handleUpdate(m.id)} className="text-emerald-600 font-semibold text-sm">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-gray-600 font-medium text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-gray-900">{m.name}</div>
                  <button onClick={() => handleToggleActive(m)}
                    className={`text-xs px-2 py-1 rounded-full font-semibold ${m.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                    {m.active ? "Active" : "Inactive"}
                  </button>
                </div>
                <div className="text-sm text-gray-700 mb-2">{m.phone || "No phone"}</div>
                <div className="flex gap-3">
                  <button onClick={() => { setEditingId(m.id); setEditName(m.name); setEditPhone(m.phone); }} className="text-blue-600 text-sm font-medium">Edit</button>
                  <button onClick={() => handleDelete(m.id)} className="text-red-600 text-sm font-medium">Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {members.length === 0 && (
          <div className="text-center text-gray-600 py-8 font-medium">No members yet. Add one above.</div>
        )}
      </div>

      {/* Members List - Desktop Table */}
      <div className="bg-white rounded-xl shadow-sm border hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-700 border-b bg-gray-50">
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Phone</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                  {editingId === m.id ? (
                    <>
                      <td className="px-6 py-3">
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-2 py-1 border rounded text-gray-900" />
                      </td>
                      <td className="px-6 py-3">
                        <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full px-2 py-1 border rounded text-gray-900" />
                      </td>
                      <td className="px-6 py-3" />
                      <td className="px-6 py-3 text-right space-x-2">
                        <button onClick={() => handleUpdate(m.id)} className="text-emerald-600 hover:underline text-sm font-medium">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-gray-600 hover:underline text-sm font-medium">Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-3 font-semibold text-gray-900">{m.name}</td>
                      <td className="px-6 py-3 text-gray-800">{m.phone || "-"}</td>
                      <td className="px-6 py-3">
                        <button onClick={() => handleToggleActive(m)}
                          className={`text-xs px-2 py-1 rounded-full font-semibold ${m.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                          {m.active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-6 py-3 text-right space-x-2">
                        <button onClick={() => { setEditingId(m.id); setEditName(m.name); setEditPhone(m.phone); }} className="text-blue-600 hover:underline text-sm font-medium">Edit</button>
                        <button onClick={() => handleDelete(m.id)} className="text-red-600 hover:underline text-sm font-medium">Delete</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {members.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-600 font-medium">No members yet. Add one above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
