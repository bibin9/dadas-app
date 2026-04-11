"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/members", label: "Members", icon: "👥" },
  { href: "/events", label: "Events", icon: "📅" },
  { href: "/purchases", label: "Purchases", icon: "🛒" },
  { href: "/payments", label: "Payments", icon: "💰" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1a2744] text-white flex flex-col">
        <div className="p-5 flex items-center gap-3 border-b border-white/10">
          <img
            src="/logo.jpg"
            alt="Dadas FC"
            width={48}
            height={48}
            className="rounded-lg"
          />
          <div>
            <h1 className="text-lg font-bold leading-tight">Dadas FC</h1>
            <p className="text-blue-300 text-xs">Together We Play</p>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-800/60 text-white"
                    : "text-blue-100 hover:bg-blue-800/40"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-blue-200 hover:text-white hover:bg-blue-800/40 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
