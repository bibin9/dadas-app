"use client";

import { useEffect, useState } from "react";

interface Member {
  id: string;
  name: string;
  phone: string;
  active: boolean;
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    const res = await fetch("/api/members");
    setMembers(await res.json());
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
    });
    setName("");
    setPhone("");
    loadMembers();
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
    if (!confirm("Delete this member? This will also remove all their dues and payments.")) return;
    await fetch(`/api/members/${id}`, { method: "DELETE" });
    loadMembers();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Members</h1>

      {/* Add Member Form */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Add Member</h2>
        <form onSubmit={handleAdd} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-800 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Member name"
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-800 mb-1">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="+971..."
            />
          </div>
          <button
            type="submit"
            className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 font-medium"
          >
            Add
          </button>
        </form>
      </div>

      {/* Members List */}
      <div className="bg-white rounded-xl shadow-sm border">
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
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="px-6 py-3">
                        <input
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="w-full px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="px-6 py-3" />
                      <td className="px-6 py-3 text-right space-x-2">
                        <button onClick={() => handleUpdate(m.id)} className="text-emerald-600 hover:underline text-sm">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-gray-500 hover:underline text-sm">Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-3 font-medium text-gray-900">{m.name}</td>
                      <td className="px-6 py-3 text-gray-800">{m.phone || "-"}</td>
                      <td className="px-6 py-3">
                        <button
                          onClick={() => handleToggleActive(m)}
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            m.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {m.active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-6 py-3 text-right space-x-2">
                        <button
                          onClick={() => { setEditingId(m.id); setEditName(m.name); setEditPhone(m.phone); }}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Edit
                        </button>
                        <button onClick={() => handleDelete(m.id)} className="text-red-600 hover:underline text-sm">
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500 font-medium">
                    No members yet. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
