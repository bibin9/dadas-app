import Link from "next/link";

export const metadata = {
  title: "User Manual — DADAS FC Treasury",
  description: "How to use the DADAS FC Treasury app — for treasurers and members.",
};

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1a2744] text-white py-6 px-4 sticky top-0 z-10 shadow">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">DADAS FC Treasury — User Manual</h1>
            <p className="text-blue-200 text-sm mt-1">Practical guide for the treasurer & team</p>
          </div>
          <Link href="/" className="text-sm bg-white/10 px-3 py-1.5 rounded-lg hover:bg-white/20">Open app</Link>
        </div>
      </header>

      <nav className="bg-white border-b sticky top-[88px] z-10">
        <div className="max-w-3xl mx-auto px-4 py-2 flex flex-wrap gap-3 text-sm">
          <a href="#videos" className="text-blue-700 hover:underline">🎬 Videos</a>
          <a href="#start" className="text-blue-700 hover:underline">Quick Start</a>
          <a href="#matches" className="text-blue-700 hover:underline">Matches</a>
          <a href="#bigticket" className="text-blue-700 hover:underline">Big Ticket</a>
          <a href="#members" className="text-blue-700 hover:underline">Members</a>
          <a href="#reports" className="text-blue-700 hover:underline">Reports</a>
          <a href="#dashboard" className="text-blue-700 hover:underline">Dashboard</a>
          <a href="#close" className="text-blue-700 hover:underline">Monthly Close</a>
          <a href="#teams" className="text-blue-700 hover:underline">Team Balancer</a>
          <a href="#backup" className="text-blue-700 hover:underline">Backups</a>
          <a href="#cheats" className="text-blue-700 hover:underline">Cheatsheet</a>
          <a href="#troubleshoot" className="text-blue-700 hover:underline">Troubleshoot</a>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-10 text-gray-900">
        {/* Video Walkthroughs */}
        <section id="videos">
          <H2>🎬 Video Walkthroughs</H2>
          <p className="text-sm text-gray-700 mb-4">Short videos covering common workflows. Tap any thumbnail to play.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {VIDEOS.map((v) => (<VideoCard key={v.title} {...v} />))}
          </div>
          <p className="text-xs text-gray-500 mt-3 italic">
            Videos missing? Email <a className="text-blue-700 underline" href="mailto:bibin9@gmail.com">bibin9@gmail.com</a> to request a recording — or contribute your own YouTube link.
          </p>
        </section>

        {/* Quick Start */}
        <section id="start">
          <H2>1. Quick Start</H2>
          <H3>URLs</H3>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Primary:</strong> <a className="text-blue-700 underline" href="https://dadas-app.vercel.app">dadas-app.vercel.app</a></li>
            <li><strong>DR backup:</strong> <a className="text-blue-700 underline" href="https://dadas-app-dr.netlify.app">dadas-app-dr.netlify.app</a> (same data — use if primary is down)</li>
          </ul>
          <H3>Login</H3>
          <Code>Username: admin{"\n"}Password: admin123 (change in Settings)</Code>
          <H3>Install as phone app (PWA)</H3>
          <p><strong>Android Chrome:</strong> open URL → ⋮ menu → <em>Install app</em>.</p>
          <p><strong>iPhone Safari:</strong> open URL → Share button → <em>Add to Home Screen</em>.</p>
        </section>

        {/* Profiles */}
        <section>
          <H2>2. Two Profiles</H2>
          <p>Switch using the toggle at the top of the sidebar:</p>
          <Table headers={["Profile", "What it tracks"]} rows={[
            ["⚽ DADAS FC", "Football matches, contributions, ground costs, expenses, P&L"],
            ["🎫 Big Ticket", "Monthly lottery purchases, member shares, draw P&L"],
          ]} />
        </section>

        {/* Matches */}
        <section id="matches">
          <H2>3. DADAS FC — Football Matches</H2>

          <H3>Log a new match</H3>
          <ol className="list-decimal list-inside space-y-1">
            <li><strong>Events</strong> menu → <strong>Quick Match</strong></li>
            <li>Fill date, per-head fee, <strong>Ground Cost*</strong> (required)</li>
            <li>Mark playing players, flip Paid/Unpaid, pick Cash/Bank/Credit per row</li>
            <li>Add guests if needed (with skill/age/position)</li>
            <li>Click <strong>Log Match & Payments</strong></li>
          </ol>

          <H3>Collect payments later</H3>
          <p>Events → expand a match → unpaid section.</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Per row: <strong>Mark Paid</strong> → row turns into <code>amount | method | Pay | X</code></li>
            <li>Bulk: tick checkboxes → blue bar shows <em>N selected</em> → pick method → <strong>Mark N Paid</strong></li>
          </ul>

          <H3>Pay from credit</H3>
          <p>Members who overpaid in past matches show <code>(cr AED X)</code> next to their name. Pick <strong>Credit</strong> in the method dropdown — amount auto-fills to 0 and their credit absorbs the due.</p>

          <H3>Share match report (WhatsApp)</H3>
          <p>Expand match → green <strong>📤 Share</strong> button. Native phone share sheet opens.</p>
          <Code>{`⚽ Football Match
📅 Sat, May 10, 2026
💰 Fee: AED 20/head · 👥 12 players

✅ Paid (10)
PLAYER         PAID    EXTRA
────────────────────────────
Bibin         20.00      —
Praveen       30.00   +10.00
Sajan         15.00   cr 5.00

❌ Unpaid (2)
• Anwar — AED 20.00
• Kiran — AED 20.00

📊 Day Summary
Cash             190.00
Bank              50.00
From Credit       20.00
──────────────────────
Collected        260.00
Ground           150.00
Surplus          110.00`}</Code>
        </section>

        {/* Big Ticket */}
        <section id="bigticket">
          <H2>4. Big Ticket — Monthly Purchases</H2>

          <H3>Log a new purchase</H3>
          <ol className="list-decimal list-inside space-y-1">
            <li><strong>Purchases</strong> menu → <strong>New Purchase</strong></li>
            <li>Fill: Description, <strong>Ticket Cost*</strong>, Date, <strong>Draw Date*</strong></li>
            <li>Select members + amounts + flip Paid/Unpaid + pick Cash/Bank/Credit</li>
            <li>Click <strong>Log Purchase & Collection</strong></li>
          </ol>

          <H3>Collect later</H3>
          <p>Purchase cards are collapsed by default. Click the heading to expand → Mark Paid per row or bulk-select multiple.</p>

          <H3>Per-purchase P&L</H3>
          <p>Each expanded card shows <strong>Ticket Cost · Expected Collection · Profit-or-Loss</strong>.</p>
          <p className="text-sm text-gray-700">Example: 21 members × AED 30 = AED 630 expected, AED 500 cost → <strong>+AED 130 profit</strong>.</p>

          <H3>Share format</H3>
          <Code>{`🎫 Monthly Big Ticket Purchase
🎰 Draw Date: Sat, May 3, 2026
📅 Sat, May 14, 2026
💰 Total: AED 630.00 · 👥 21 members

✅ Paid (21)
NAME         PAID    BAL
────────────────────────
Bibin          30  cr100
Pratheesh      30  cr100
Sudeesh        30   cr30

📊 Summary
Expected     630 (21×30)
────────────────────
Cash          400
Bank          200
From Credit    30
────────────────────
Collected     600
Credits Hd    920
Outstanding     0`}</Code>
          <p className="text-sm text-gray-700"><strong>BAL</strong> column = each member&apos;s lifetime Big Ticket credit (<code>cr100</code> = AED 100 overpaid).</p>
        </section>

        {/* Members */}
        <section id="members">
          <H2>5. Members</H2>
          <p>Members page — add, edit, delete, toggle Active/Inactive.</p>

          <H3>Member groups</H3>
          <p>Used to pre-select members for events/purchases and to scope the Big Ticket profile. Create on Members page → New Group.</p>
          <p>To set the Big Ticket group: <strong>Settings → Big Ticket Member Group</strong>.</p>

          <H3>Guest cleanup</H3>
          <p>Guests added during matches show with an orange <strong>GUEST</strong> badge. Use the <strong>🧹 Cleanup N guests</strong> button at the top to bulk-delete after matches.</p>
        </section>

        {/* Reports */}
        <section id="reports">
          <H2>6. Reports</H2>
          <p><strong>DADAS FC:</strong> Event Collection & P&L tab + Outstanding tab.</p>
          <p><strong>Big Ticket:</strong> Purchase P&L (cost vs expected collection per draw) + Outstanding.</p>
          <p>Every section has a <strong>📤 Share via WhatsApp</strong> button.</p>
        </section>

        {/* Dashboard */}
        <section id="dashboard">
          <H2>7. Dashboard</H2>

          <H3>DADAS FC — 6 cards</H3>
          <Table headers={["Card", "Meaning"]} rows={[
            ["Total Received", "Cash + bank received this period"],
            ["Total Costs", "Ground + expenses this period"],
            ["Total Income", "Sponsorships + carry-forward profit from monthly closes"],
            ["Outstanding", "Total dues from members"],
            ["DADAS FC Fund", "Real club money (Group Fund − Player Credits)"],
            ["Player Credits", "Total overpaid amounts owed back to players"],
          ]} />

          <H3>Big Ticket — 4 cards</H3>
          <Table headers={["Card", "Meaning"]} rows={[
            ["Total Purchases", "All-time purchase value"],
            ["Collected", "Cash + bank received"],
            ["Outstanding", "Unpaid amount across all purchases"],
            ["Members Credits", "Advance payments held (owed back)"],
          ]} />
        </section>

        {/* Monthly Close */}
        <section id="close">
          <H2>8. Monthly Close (DADAS FC)</H2>
          <p>End-of-month &quot;close the books&quot; feature. Locks in real profit, rolls it into <strong>Total Income</strong>, resets the dashboard&apos;s current-period totals to 0.</p>
          <ol className="list-decimal list-inside space-y-1">
            <li><strong>Settings</strong> → scroll to <strong>📅 Monthly Close</strong></li>
            <li>Read the preview (Received / Income / Costs / credit change / Real profit)</li>
            <li>Click <strong>Close Month</strong> → confirm</li>
          </ol>
          <p className="text-sm text-gray-700">If you closed by mistake, <strong>Undo Last Close</strong> is right there. Group Fund stays exactly the same before and after a close; member balances are never touched.</p>
        </section>

        {/* Team Balancer */}
        <section id="teams">
          <H2>9. Team Balancer</H2>
          <p>Generates balanced 2-team lineups based on skill + age + position.</p>
          <ol className="list-decimal list-inside space-y-1">
            <li><strong>Player Pool</strong> tab — set each member&apos;s skill tier, age group, position (one-time setup)</li>
            <li><strong>Make Teams</strong> tab — tap player chips, add guests, auto-balances</li>
            <li>🔀 Shuffle to regenerate. 📤 Share sends a WhatsApp team sheet.</li>
          </ol>
        </section>

        {/* Backups */}
        <section id="backup">
          <H2>10. Backups</H2>
          <H3>Manual snapshot anytime</H3>
          <Code>https://dadas-app.vercel.app/api/backup?token=dadas-backup-2026-secure&amp;download=1</Code>
          <p className="text-sm text-gray-700">Downloads a JSON of your full DB. Save it somewhere safe.</p>
          <H3>Weekly auto-backup</H3>
          <p>Scheduled every Sunday at 06:00 Dubai. Snapshot is committed to the GitHub repo at <code>backups/2026-W##.json</code> + <code>backups/latest.json</code> (when GitHub token is configured).</p>
        </section>

        {/* Cheatsheet */}
        <section id="cheats">
          <H2>11. Common Tasks Cheatsheet</H2>
          <Table headers={["I want to…", "How"]} rows={[
            ["Record a match with everyone paid", "Quick Match → fill fee + cost → All Paid → Log Match"],
            ["Collect from one player", "Events → expand match → Mark Paid → Pay"],
            ["Bulk collect from many", "Tick checkboxes → bar at bottom → Mark N Paid"],
            ["Apply a player's credit", "When marking paid, select Credit in method dropdown"],
            ["Share a match summary", "Expand match → 📤 Share"],
            ["See who owes money", "Dashboard top panel OR Reports → Outstanding"],
            ["Add a guest player", "Match form → + Add Guest"],
            ["Remove accidentally-added guest", "Edit match → untoggle them → Save"],
            ["Clean up old guest records", "Members page → 🧹 Cleanup N guests"],
            ["Edit a past purchase", "Purchases → expand → Edit"],
            ["Take backup now", "Visit the backup URL above"],
            ["Close a month", "Settings → Monthly Close → Close Month"],
          ]} />
        </section>

        {/* Troubleshoot */}
        <section id="troubleshoot">
          <H2>12. Troubleshooting</H2>
          <H3>Dashboard / page stuck on &quot;Loading…&quot;</H3>
          <p>Hard refresh: Ctrl+Shift+R (desktop) or fully close and reopen the PWA on phone.</p>
          <H3>App showing old data after a change</H3>
          <p>PWA caches aggressively. Close and reopen the app, or pull down to refresh.</p>
          <H3>Can&apos;t see all members on Big Ticket</H3>
          <p>Settings → Big Ticket Member Group must be set to your group.</p>
          <H3>Member delete fails</H3>
          <p>The endpoint cascades manually (payments → dues → splits → groups → skill → member). The error message tells you why if it fails.</p>
        </section>

        {/* DR */}
        <section>
          <H2>13. Disaster Recovery</H2>
          <Table headers={["Failure", "Action"]} rows={[
            ["Vercel down", "Use Netlify URL: dadas-app-dr.netlify.app"],
            ["Netlify down", "Use Vercel URL"],
            ["Both down", "Data is safe in Turso — wait for either host to recover"],
            ["Database lost", "Restore from latest weekly backup JSON in GitHub backups/ folder"],
            ["Accidental delete", "Restore from a backup snapshot"],
          ]} />
        </section>

        <footer className="text-center text-sm text-gray-500 pt-8 border-t">
          Last updated: May 14, 2026 · <a href="/" className="text-blue-700 underline">Open app</a>
        </footer>
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Video walkthroughs — drop in YouTube video IDs as you record them.
// To add a video:
//   1. Upload to YouTube (Unlisted is fine — only people with the link can view)
//   2. Copy the 11-character video ID from the URL
//      e.g. https://youtu.be/dQw4w9WgXcQ → "dQw4w9WgXcQ"
//   3. Paste into the `youtubeId` field below
// Cards with no youtubeId show a "Recording soon" placeholder.
// ────────────────────────────────────────────────────────────────────
const VIDEOS: Video[] = [
  {
    title: "1. Quick Start — Login & Install on Phone",
    description: "Log in, change password, install as a PWA on Android/iPhone.",
    duration: "2 min",
    youtubeId: "", // ← paste video ID when recorded
  },
  {
    title: "2. Logging a Football Match",
    description: "Quick Match form, marking players paid via cash/bank/credit, adding guests.",
    duration: "3 min",
    youtubeId: "",
  },
  {
    title: "3. Collecting Payments Later",
    description: "Per-row Mark Paid + bulk-select collection, undo paid mark.",
    duration: "2 min",
    youtubeId: "",
  },
  {
    title: "4. Big Ticket Purchase & Collection",
    description: "Create a monthly purchase with Draw Date + Ticket Cost, collect from 21 members fast.",
    duration: "4 min",
    youtubeId: "",
  },
  {
    title: "5. Sharing Reports on WhatsApp",
    description: "Share format for matches, purchases, and outstanding-balance reminders.",
    duration: "2 min",
    youtubeId: "",
  },
  {
    title: "6. Monthly Close (End of Month)",
    description: "Close the books — roll profit into income, reset counters, preserve credits.",
    duration: "3 min",
    youtubeId: "",
  },
  {
    title: "7. Team Balancer for Match Day",
    description: "Set up player skill pool, generate balanced teams, share team sheet.",
    duration: "3 min",
    youtubeId: "",
  },
  {
    title: "8. Backups & Disaster Recovery",
    description: "Manual snapshot URL, weekly auto-backup, what to do if something breaks.",
    duration: "2 min",
    youtubeId: "",
  },
];

interface Video {
  title: string;
  description: string;
  duration: string;
  youtubeId: string;
}

function VideoCard({ title, description, duration, youtubeId }: Video) {
  const hasVideo = youtubeId.trim().length > 0;
  return (
    <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
      {hasVideo ? (
        <div className="relative aspect-video bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title={title}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="aspect-video bg-gradient-to-br from-gray-700 to-gray-900 flex flex-col items-center justify-center text-white">
          <div className="text-3xl mb-1">🎬</div>
          <div className="text-xs opacity-80 uppercase tracking-wide">Recording soon</div>
        </div>
      )}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm text-gray-900">{title}</h3>
          <span className="text-xs text-gray-500 flex-shrink-0">{duration}</span>
        </div>
        <p className="text-xs text-gray-600 mt-1">{description}</p>
      </div>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-[#1a2744] mb-3 scroll-mt-32">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2">{children}</h3>;
}
function Code({ children }: { children: React.ReactNode }) {
  return <pre className="bg-gray-900 text-gray-100 text-xs rounded-lg p-3 overflow-x-auto whitespace-pre my-2">{children}</pre>;
}
function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            {headers.map((h) => <th key={h} className="border px-3 py-2 text-left font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {r.map((c, j) => <td key={j} className="border px-3 py-2 align-top">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
