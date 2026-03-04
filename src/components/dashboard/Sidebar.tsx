"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Search,
  Settings,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/network", label: "My Network", icon: Users },
  { href: "/dashboard/query", label: "Query", icon: Search },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-[260px] md:fixed md:inset-y-0 bg-surface border-r border-border">
        <div className="flex items-center gap-2.5 h-16 px-6 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-white font-bold text-xs">C</span>
          </div>
          <Link href="/dashboard" className="text-lg font-bold tracking-tight">
            Circl
          </Link>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 h-11 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-foreground text-white shadow-sm"
                    : "text-warm-500 hover:text-foreground hover:bg-warm-100"
                }`}
              >
                <item.icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2.2 : 1.8} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-border">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 h-11 rounded-xl text-[13px] font-medium text-warm-400 hover:text-foreground hover:bg-warm-100 transition-all duration-200 w-full"
          >
            <LogOut className="w-[18px] h-[18px]" strokeWidth={1.8} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-border z-50 safe-area-bottom">
        <div className="flex items-center justify-around h-[64px]">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] transition-all duration-200 ${
                  isActive ? "text-accent" : "text-warm-400"
                }`}
              >
                <item.icon
                  className="w-5 h-5"
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span className={`text-[10px] ${isActive ? "font-semibold" : "font-medium"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
