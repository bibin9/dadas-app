"use client";

import { useState } from "react";
import { parseNameList, matchNames, Candidate } from "@/lib/name-match";

interface Props {
  candidates: Candidate[]; // members + saved guests (id + name)
  onApply: (ids: string[]) => void; // called with matched ids → select + build
}

// "Paste the WhatsApp list" box: parses pasted names, fuzzy-matches them to
// the player pool, auto-selects the matches, and clearly reports names it
// couldn't find so they can be added as guests. Never guesses new players.
export default function PasteTeamList({ candidates, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [summary, setSummary] = useState<{
    matched: { input: string; name: string }[];
    unmatched: string[];
  } | null>(null);

  function handleMatch() {
    const lines = parseNameList(text);
    const res = matchNames(lines, candidates);
    setSummary({
      matched: res.matched.map((m) => ({ input: m.input, name: m.name })),
      unmatched: res.unmatched,
    });
    onApply(res.matched.map((m) => m.id));
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-sm font-semibold text-gray-800"
      >
        <span>📋 Paste player list from WhatsApp</span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Paste the list here, e.g.\n1. Bibin\n2. Nikhil\n3. Sudeesh\n..."}
            rows={6}
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleMatch}
              disabled={!text.trim()}
              className="bg-[#1a2744] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#243556] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ✓ Match & Select Players
            </button>
            {text.trim() && (
              <button
                onClick={() => { setText(""); setSummary(null); }}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
              >
                Clear
              </button>
            )}
          </div>

          {summary && (
            <div className="mt-3 space-y-2">
              <div className="text-xs font-semibold text-green-700 bg-green-50 rounded-lg px-3 py-2">
                ✅ {summary.matched.length} player{summary.matched.length === 1 ? "" : "s"} matched &amp; selected
                {summary.matched.some((m) => m.input.toLowerCase().replace(/[^a-z]/g, "") !== m.name.toLowerCase().replace(/[^a-z]/g, "")) && (
                  <span className="block mt-1 font-normal text-green-800">
                    {summary.matched
                      .filter((m) => m.input.toLowerCase().replace(/[^a-z]/g, "") !== m.name.toLowerCase().replace(/[^a-z]/g, ""))
                      .map((m) => `"${m.input}" → ${m.name}`)
                      .join(", ")}
                  </span>
                )}
              </div>
              {summary.unmatched.length > 0 && (
                <div className="text-xs font-semibold text-orange-800 bg-orange-50 rounded-lg px-3 py-2">
                  ⚠️ Not in the player pool (excluded): {summary.unmatched.join(", ")}
                  <span className="block mt-1 font-normal">
                    Add them as guest players below to include them in the teams.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
