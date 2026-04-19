"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ProfileProvider, useProfile, Profile } from "@/lib/profile-context";

const dadasNavItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/members", label: "Members", icon: "👥" },
  { href: "/events", label: "Events", icon: "📅" },
  { href: "/team-balancer", label: "Teams", icon: "⚽" },
  { href: "/income", label: "Income", icon: "🏆" },
  { href: "/expenses", label: "Expenses", icon: "💸" },
  { href: "/payments", label: "Payments", icon: "💰" },
  { href: "/reports", label: "Reports", icon: "📋" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

const bigticketNavItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/members", label: "Members", icon: "👥" },
  { href: "/purchases", label: "Purchases", icon: "🛒" },
  { href: "/payments", label: "Payments", icon: "💰" },
  { href: "/reports", label: "Reports", icon: "📋" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

function ProfileSwitcher({ compact }: { compact?: boolean }) {
  const { profile, setProfile } = useProfile();
  return (
    <div className={`flex ${compact ? "gap-1" : "gap-1 p-1"} bg-white/10 rounded-lg`}>
      <button
        onClick={() => setProfile("dadas")}
        className={`flex items-center gap-1.5 px-3 ${compact ? "py-1.5 text-xs" : "py-2 text-sm"} rounded-md font-semibold transition-all ${
          profile === "dadas"
            ? "bg-white text-[#1a2744] shadow-sm"
            : "text-blue-200 hover:text-white hover:bg-white/10"
        }`}
      >
        <span>⚽</span>
        <span>{compact ? "DADAS" : "DADAS FC"}</span>
      </button>
      <button
        onClick={() => setProfile("bigticket")}
        className={`flex items-center gap-1.5 px-3 ${compact ? "py-1.5 text-xs" : "py-2 text-sm"} rounded-md font-semibold transition-all ${
          profile === "bigticket"
            ? "bg-white text-[#1a2744] shadow-sm"
            : "text-blue-200 hover:text-white hover:bg-white/10"
        }`}
      >
        <span>🎫</span>
        <span>{compact ? "Big Ticket" : "Big Ticket"}</span>
      </button>
    </div>
  );
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const { profile } = useProfile();

  const navItems = profile === "dadas" ? dadasNavItems : bigticketNavItems;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="md:hidden bg-[#1a2744] text-white sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="Dadas FC" width={36} height={36} className="rounded-lg" />
            <h1 className="text-base font-bold">Dadas FC</h1>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-lg hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
        <div className="px-4 pb-3">
          <ProfileSwitcher compact />
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {menuOpen && (
        <div className="md:hidden bg-[#1a2744] text-white px-4 pb-4 space-y-1 sticky top-[108px] z-50">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${active ? "bg-blue-800/60 text-white" : "text-blue-100 hover:bg-blue-800/40"}`}>
                <span>{item.icon}</span>{item.label}
              </Link>
            );
          })}
          <button onClick={handleLogout} className="w-full text-left px-3 py-2.5 text-sm text-blue-200 hover:text-white hover:bg-blue-800/40 rounded-lg">
            Sign Out
          </button>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-[#1a2744] text-white flex-col flex-shrink-0">
        <div className="p-5 flex items-center gap-3 border-b border-white/10">
          <img src="/logo.jpg" alt="Dadas FC" width={48} height={48} className="rounded-lg" />
          <div>
            <h1 className="text-lg font-bold leading-tight">Dadas FC</h1>
            <p className="text-blue-300 text-xs">Together We Play</p>
          </div>
        </div>
        <div className="px-4 pt-4 pb-2">
          <ProfileSwitcher />
        </div>
        <nav className="flex-1 px-4 space-y-1 pt-2">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active ? "bg-blue-800/60 text-white" : "text-blue-100 hover:bg-blue-800/40"}`}>
                <span>{item.icon}</span>{item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4">
          <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-blue-200 hover:text-white hover:bg-blue-800/40 rounded-lg transition-colors">
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-8 overflow-auto min-w-0">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileProvider>
      <LayoutInner>{children}</LayoutInner>
    </ProfileProvider>
  );
}
