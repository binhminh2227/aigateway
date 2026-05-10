"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useLang, LangToggle } from "@/lib/i18n";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLang();
  const [balance, setBalance] = useState<number | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  const [planRoom, setPlanRoom] = useState<number>(0);
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/billing").then(r => r.json()).then(d => {
        setBalance(d.balance ?? null);
        setPlanName(d.planName ?? null);
        setPlanExpiresAt(d.planExpiresAt ?? null);
        setPlanRoom(Math.max(0, (d.dailyLimit ?? 0) - (d.planDailyUsed ?? 0)));
      });
    }
  }, [status]);

  const planActive = planName && planExpiresAt && new Date(planExpiresAt) > new Date();

  const navItems = [
    { href: "/dashboard", label: t.nav.dashboard, icon: "⊞", exact: true },
    { href: "/dashboard/api-keys", label: t.nav.apiKeys, icon: "🔑" },
    { href: "/dashboard/usage", label: t.nav.usage, icon: "📊" },
    { href: "/dashboard/billing", label: t.nav.billing, icon: "🔄" },
    { href: "/dashboard/orders", label: t.nav.orders, icon: "📄" },
    { href: "/dashboard/redeem", label: t.nav.redeem, icon: "🎁" },
    { href: "/dashboard/profile", label: t.nav.profile, icon: "👤" },
    { href: "/dashboard/docs", label: t.nav.docs, icon: "📖" },
  ];

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className="w-52 bg-[#0d1117] border-r border-gray-800/60 flex flex-col fixed h-full">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-800/60">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-xs">AI</div>
            <span className="font-bold text-white text-sm tracking-wide">AI GATEWAY</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-teal-600/20 text-teal-400 font-medium"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/60"
                }`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          {session.user.role === "admin" && (
            <Link
              href="/admin"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname.startsWith("/admin")
                  ? "bg-purple-600/20 text-purple-400 font-medium"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/60"
              }`}
            >
              <span className="text-base w-5 text-center">⚙️</span>
              <span>{t.nav.admin}</span>
            </Link>
          )}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-gray-800/60 space-y-1">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-teal-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {session.user.email?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{session.user.name || session.user.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800/60 rounded-lg text-sm transition-colors"
          >
            <span className="text-base w-5 text-center">←</span>
            <span>{t.nav.signout}</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-52 min-h-screen">
        {/* Top bar */}
        <header className="h-12 border-b border-gray-800/60 bg-[#0d1117] flex items-center justify-end px-6 gap-4 sticky top-0 z-10">
          <LangToggle />
          {planActive && (
            <span className="text-purple-400 text-xs font-medium bg-purple-900/30 border border-purple-800/50 px-2 py-0.5 rounded" title={`Hết hạn: ${new Date(planExpiresAt!).toLocaleDateString("vi-VN")}`}>
              📦 {planName} · còn {planRoom.toFixed(2)}/ngày
            </span>
          )}
          <span className="text-teal-400 text-xs font-medium bg-teal-900/30 border border-teal-800/50 px-2 py-0.5 rounded">
            💳 {t.topbar.balance}: {balance !== null ? `${balance.toFixed(2)} credit` : "..."}
          </span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-teal-700 flex items-center justify-center text-white text-xs font-bold">
              {session.user.email?.[0]?.toUpperCase()}
            </div>
            <span className="text-white text-xs">{session.user.name || session.user.email?.split("@")[0]}</span>
          </div>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
