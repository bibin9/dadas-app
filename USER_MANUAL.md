# DADAS FC Treasury — User Manual

Practical guide for the treasurer. Skim the section you need; skip the rest.

---

## 1. Quick Start

### URLs
- **Primary:** https://dadas-app.vercel.app
- **DR backup:** https://dadas-app-dr.netlify.app (same data, use if primary is down)

### Login
- Username: `admin`
- Password: `admin123` (change on Settings → Change Password ASAP)

### Install as phone app (PWA)
**Android (Chrome):** Open URL → ⋮ menu → **Install app** → home-screen icon appears.

**iPhone (Safari only):** Open URL in Safari → Share button → **Add to Home Screen**.

The PWA looks and feels like a native app, with the menu hidden under the status bar handled correctly.

---

## 2. Two Profiles

Switch using the toggle at the top of the sidebar (or mobile menu):

| Profile | What it tracks |
|---|---|
| **⚽ DADAS FC** | Football matches, events, member contributions, ground costs, expenses, P&L |
| **🎫 Big Ticket** | Monthly lottery-ticket purchases, member shares, draw P&L |

Each profile shows its own dashboard, members, payments, and reports. Both share the same member list, but Big Ticket only shows the configured group's members.

---

## 3. DADAS FC — Football Matches

### Log a new match
1. **Events** menu → **Quick Match** (blue button)
2. Fill in:
   - Date (defaults to today)
   - Per-head fee (e.g. AED 20)
   - **Ground Cost*** (required — actual venue cost, e.g. AED 150)
   - Notes (optional)
3. **Player list:**
   - Click the ✓ circle to mark "playing"
   - For each playing player you can flip Paid/Unpaid right here
   - When Paid → choose **Cash / Bank / Credit** (Credit only shows if member has enough credit)
   - Custom amount field if they overpaid
4. **Add guests** if needed (name + skill + age + position)
5. Click **Log Match & Payments**

### Edit a match
- Find it in Events list → click **Edit**
- Form pre-populates with current state (who played, who paid, methods, amounts)
- Update anything → **Update Match**
- Payments sync correctly — credits are preserved

### Collect payment from an unpaid player
- Events → expand a match → in the Unpaid section
- Click **Mark Paid** next to a name → row expands with `amount | method | Pay | X`
- Adjust amount if needed, pick method, click **Pay**
- **Bulk pay:** tick checkboxes on multiple players → blue bar appears at bottom → pick method → **Mark N Paid**

### Credit-pay a member
- If a member overpaid in a previous match (has credit), their row shows `(cr AED X)`
- Pick **Credit** in the method dropdown — amount auto-fills to 0
- Their credit absorbs the due; no new cash needed

### Share match report (WhatsApp)
- Expand match → green **📤 Share** button
- Native share sheet opens (on phone) or copies to clipboard (desktop)

Sample share:
```
⚽ Football Match
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
Surplus          110.00
```

---

## 4. Big Ticket — Monthly Purchases

### Log a new purchase
1. **Purchases** menu → **New Purchase**
2. Fill in:
   - Description (e.g. "Monthly Big Ticket Purchase")
   - **Ticket Cost*** (required — actual cost of the ticket, e.g. AED 500)
   - Date
   - **Draw Date*** (required — when the lottery draws)
   - Notes (optional)
3. **Member section** (same UX as match form):
   - Default share auto-applies (set in Settings)
   - Custom amount per member if different
   - Flip Paid/Unpaid + pick Cash/Bank/Credit per row
   - Bulk buttons: All / None / All Paid / None Paid / Load Group
4. Click **Log Purchase & Collection**

### Collect payments later
- Each purchase card is collapsed by default (shows heading + status badge)
- Click the heading to expand → see Paid + Unpaid sections
- **Mark Paid** per row (transforms to amount/method/Pay) OR check multiple + use the bulk-pay bar
- Click **undo** next to any Paid row to revert that payment

### Edit a purchase
- Expand → **Edit** button → form opens with current data
- Add/remove members, change amounts, change draw date / cost
- **Update Purchase** — credits and advance payments are preserved (bug fixed May 14, 2026)

### Per-purchase P&L
- Each expanded card shows: **Ticket Cost / Expected Collection / Profit-or-Loss**
- Example: 21 members × AED 30 = AED 630 expected, AED 500 cost → +AED 130 profit
- See Reports → Big Ticket for the full P&L list

### Share purchase report (WhatsApp)
Sample share — clean, tabular, fits WhatsApp width:
```
🎫 Monthly Big Ticket Purchase
🎰 Draw Date: Sat, May 3, 2026
📅 Sat, May 14, 2026
💰 Total: AED 630.00 · 👥 21 members

✅ Paid (21)
NAME         PAID    BAL
────────────────────────
Bibin          30  cr100
Pratheesh      30  cr100
Sudeesh        30   cr30
...

📊 Summary
Expected     630 (21×30)
────────────────────
Cash          400
Bank          200
From Credit    30
────────────────────
Collected     600
Credits Hd    920
Outstanding     0
```

**BAL** column = each member's lifetime Big Ticket credit (`cr100` = AED 100 overpaid).

---

## 5. Members

### Add / edit / delete
- **Members** menu → form at top to add (name + phone)
- Each row has Edit / Delete / toggle Active-Inactive

### Member groups
Used to:
- Pre-select members for events/purchases ("Load Group")
- Scope the **Big Ticket** profile to a specific group

To create: scroll down on Members → **New Group** → name + check members → Save.

To set the **Big Ticket group**: Settings → **Big Ticket Member Group** dropdown → save. Dashboard, members list, and purchases will scope to those members only.

### Guest cleanup
Guests added during match creation appear with an orange **GUEST** badge. After matches, click the **🧹 Cleanup N guests** button at the top of the Members page to bulk-delete lingering guest records.

---

## 6. Reports

### DADAS FC Reports
Two tabs:
1. **Event Collection & P&L** — every match with attendance, P&L, methods. Share button per event.
2. **Outstanding Balances** — every member who owes money. Share for chase-up.

### Big Ticket Reports
- **Purchase P&L** — per-purchase card showing:
  - Draw Date (as heading)
  - Ticket Cost, Expected Collection, Collected, Net profit
- **Outstanding** — members with unpaid splits

### Sharing
Every report has a **📤 Share via WhatsApp** button. Same monospace table format used in match/purchase shares.

---

## 7. Dashboard

### DADAS FC dashboard (6 cards)
| Card | Meaning |
|---|---|
| Total Received | Cash + bank received this period |
| Total Costs | Ground + expenses this period (subtitle shows split) |
| Total Income | Sponsorships + carry-forward profit from past monthly closes |
| Outstanding | Total dues from members |
| DADAS FC Fund | Real club money (Group Fund − Player Credits) |
| Player Credits | Total overpaid amounts owed back to players |

### Big Ticket dashboard (4 cards)
| Card | Meaning |
|---|---|
| Total Purchases | All-time purchase value |
| Collected | Cash + bank received |
| Outstanding | Unpaid amount across all purchases |
| Members Credits | Advance payments held (owed back) |

### Outstanding members panel
Auto-appears at the top when anyone owes money. Click **Share** to send a WhatsApp reminder list.

---

## 8. Monthly Close (DADAS FC)

End-of-month "close the books" feature. Locks in the month's real profit (excluding player credit), rolls it forward into **Total Income**, and resets the dashboard's current-period **Total Received / Total Cost** to 0.

### How to close
1. **Settings** → scroll to **📅 Monthly Close**
2. Preview card shows current open period stats
3. Read the breakdown carefully:
   - Received (Cash+Bank) / Income / Costs / Player credit change
   - **Real profit** = Gross profit − new player credit liability
4. Click **Close Month** → confirm the dialog
5. Done. Profit is carried into Total Income; counters reset.

### Undo a close
- If you closed by mistake, click **Undo Last Close** in the same panel (within reason — best within 24h).

### Math guarantee
Group Fund stays exactly the same before and after a close. Member balances are never touched.

---

## 9. Team Balancer

Builds balanced teams for matches based on skill + age + position.

### Player Pool (one-time setup)
- **Team Maker** menu → **Player Pool** tab
- For each member, set: Skill Tier (Legend / Master / Gold / Silver / Bronze / Starter), Age Group (Under 30 / 30-40 / 40-50 / Above 50), Position (GK / DEF / MID / FWD / Any)
- Save per row

### Make Teams
- **Make Teams** tab
- Tap player chips to select who's playing (auto-generates as you select)
- Add guests with their skill/age/position
- Result: two color-coded teams, balanced by player count + position spread + skill+age points
- **🔀 Shuffle** to regenerate (different random)
- **📤 Share** sends WhatsApp team sheet

---

## 10. Backups

### Manual snapshot anytime
Visit (or bookmark) this URL — downloads a JSON of your full DB:
```
https://dadas-app.vercel.app/api/backup?token=dadas-backup-2026-secure&download=1
```

### Weekly auto-backup
- Scheduled every Sunday at 06:00 Dubai (02:00 UTC)
- Snapshot pushed to your GitHub repo (when `GITHUB_TOKEN` + `GITHUB_BACKUP_REPO` env vars are configured on Vercel)
- File path: `backups/2026-W##.json` + `backups/latest.json`

### Manual snapshots stored
- `backups/manual-2026-05-14.json` — full DB after the credit restoration

### Disaster recovery
If something corrupts the data:
1. Find the most recent backup JSON
2. Contact technical help (or do it yourself by parsing the JSON and re-inserting via Prisma)
3. Order matters: members → groups → events/purchases → dues/splits → payments → settings

---

## 11. Settings

| Setting | What it does |
|---|---|
| **Group / Company Name** | Shown on dashboard fund card label |
| **Default Match Fee** | Pre-fills the match fee field |
| **Default Big Ticket Share** | Per-member default for new purchases |
| **Big Ticket Member Group** | Which group's members appear on Big Ticket profile |
| **Bank Details** | Shown to members for transfer instructions |
| **Templates** | Pre-set match/event/purchase templates for quick creation |
| **Monthly Close** | See section 8 |
| **Change Password** | Update admin password |

---

## 12. Common Tasks Cheatsheet

| I want to… | How |
|---|---|
| Record a match with everyone paid | Quick Match → fill fee + cost → All Paid → Log Match |
| Collect from one player | Events → expand match → Mark Paid → Pay |
| Bulk collect from many | Tick checkboxes → blue bar appears → Mark N Paid |
| Apply a player's credit | When marking paid, select **Credit** in method dropdown |
| Share a match summary | Expand match → 📤 Share |
| See who owes money | Dashboard top panel OR Reports → Outstanding |
| Add a guest player | Match form → bottom → + Add Guest |
| Remove an accidentally-added guest | Edit match → find them in player list (GUEST badge) → click ✓ to untoggle → Save |
| Clean up old guest records | Members page → 🧹 Cleanup N guests button |
| Edit a past purchase | Purchases → expand → Edit |
| Set up new Big Ticket month | Purchases → New Purchase (or click a 🎫 template) |
| Take backup now | Visit the backup URL (manual snapshot) |
| Close a month | Settings → Monthly Close → Close Month |

---

## 13. Troubleshooting

### Dashboard / page stuck on "Loading…"
- Hard refresh: Ctrl+Shift+R (desktop) or fully close and reopen the PWA on phone
- If both Vercel and Netlify URLs fail with the same error → check WiFi / try mobile data / try a different browser

### App showing old data after a change
- PWA caches aggressively. Close and reopen the app
- Or pull down to refresh on the page

### Can't see all members on Big Ticket
- Settings → Big Ticket Member Group must be set to your group
- If unset, dashboard falls back to showing all active members

### Edit destroyed credits (legacy bug, fixed May 14)
- Already fixed. Editing a purchase no longer resets advance amounts.
- If you have a backup JSON from before, contact for restore help.

### Member delete fails
- The endpoint cascades manually (payments → dues → splits → groups → skill → member). If it still fails, the error message tells you why.

---

## 14. Disaster Recovery (DR)

| Failure | Action |
|---|---|
| Vercel down | Use Netlify URL: `dadas-app-dr.netlify.app` |
| Netlify down | Use Vercel URL (primary) |
| Both down | Wait for either to recover. Data is safe in Turso. |
| Turso database lost | Restore from latest weekly backup JSON in GitHub `backups/` folder |
| Accidental delete of a record | Restore from backup |
| Code regression | `git checkout backup-<date>-<feature>` tag |

Backup tags in GitHub (`bibin9/dadas-app` repo) for major changes:
- `backup-2026-05-14-before-bigticket-pnl`
- `backup-2026-05-14-before-bigticket-parity`
- `backup-2026-05-14-before-guest-credit-fixes`
- `backup-2026-05-14-before-monthly-close`
- … (one before every significant feature)

---

## 15. Where to Get Help

- Technical changes / new features: contact developer
- Bug reports: provide steps to reproduce + a screenshot
- Always do a backup (visit the backup URL and save the JSON) before major changes

---

*Last updated: May 14, 2026*
