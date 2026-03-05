"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Star,
  Users,
  Search,
  Shield,
  Settings,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import UserProfilePopup from "./UserProfilePopup";

const ADMIN_EMAILS = ["saras@incommon.ai", "piyush@incommon.ai"];

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/hit-list", label: "Hit List", icon: Star },
  { href: "/dashboard/network", label: "My Network", icon: Users },
  { href: "/dashboard/query", label: "Query", icon: Search },
];

const mobileNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/hit-list", label: "Hit List", icon: Star },
  { href: "/dashboard/network", label: "Network", icon: Users },
  { href: "/dashboard/query", label: "Query", icon: Search },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (user.email && ADMIN_EMAILS.includes(user.email)) {
        setIsAdmin(true);
      }
      setUserEmail(user.email || "");

      const { data: profile } = await supabase
        .from("users")
        .select("full_name, company_name")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserName((profile.full_name as string) || "");
        setCompanyName((profile.company_name as string) || "");
      }
    }
    loadUser();
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-[240px] md:fixed md:inset-y-0 bg-white border-r border-[#E3E8EF]">
        <div className="flex items-center gap-2.5 h-16 px-6 border-b border-[#F0F3F7]">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0ABF53]" />
          <Link href="/dashboard" className="text-lg font-bold tracking-tight text-[#0A2540]">
            Circl
          </Link>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 h-10 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-[#E6F9EE] text-[#0A2540] font-semibold border-l-[3px] border-[#0ABF53] pl-[9px]"
                    : "text-[#596780] hover:text-[#0A2540] hover:bg-[#F6F8FA]"
                }`}
              >
                <item.icon
                  className={`w-5 h-5 ${isActive ? "text-[#0ABF53]" : ""}`}
                  strokeWidth={isActive ? 2 : 1.8}
                />
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/dashboard/admin"
              className={`flex items-center gap-3 px-3 h-10 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                pathname === "/dashboard/admin"
                  ? "bg-[#E6F9EE] text-[#0A2540] font-semibold border-l-[3px] border-[#0ABF53] pl-[9px]"
                  : "text-[#596780] hover:text-[#0A2540] hover:bg-[#F6F8FA]"
              }`}
            >
              <Shield
                className={`w-5 h-5 ${pathname === "/dashboard/admin" ? "text-[#0ABF53]" : ""}`}
                strokeWidth={pathname === "/dashboard/admin" ? 2 : 1.8}
              />
              Admin
            </Link>
          )}
        </nav>

        <UserProfilePopup
          userName={userName}
          userEmail={userEmail}
          companyName={companyName}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E3E8EF] z-50 safe-area-bottom">
        <div className="flex items-center justify-around h-[64px]">
          {mobileNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] transition-all duration-200 ${
                  isActive ? "text-[#0ABF53]" : "text-[#96A0B5]"
                }`}
              >
                <item.icon
                  className="w-5 h-5"
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span
                  className={`text-[10px] ${isActive ? "font-semibold" : "font-medium"}`}
                >
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
