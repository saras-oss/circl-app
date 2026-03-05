"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ChevronUp,
  Target,
  Settings,
  CreditCard,
  BarChart3,
  LogOut,
} from "lucide-react";

interface UserProfilePopupProps {
  userName: string;
  userEmail: string;
  companyName: string;
  onSignOut: () => void;
}

export default function UserProfilePopup({
  userName,
  userEmail,
  companyName,
  onSignOut,
}: UserProfilePopupProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : userEmail?.[0]?.toUpperCase() || "?";

  const displayName = userName?.split(" ")[0] || userEmail?.split("@")[0] || "";

  return (
    <div ref={ref} className="relative px-3 py-3 border-t border-border">
      {/* Popup menu */}
      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-xl border border-warm-200 shadow-lg overflow-hidden animate-fade-in-up z-50">
          {/* User info header */}
          <div className="px-4 py-3.5 border-b border-warm-100">
            <p className="text-sm font-semibold text-foreground truncate">
              {userName || userEmail}
            </p>
            <p className="text-xs text-warm-400 truncate mt-0.5">{userEmail}</p>
            {companyName && (
              <p className="text-xs text-warm-400 truncate mt-0.5">
                {companyName}
              </p>
            )}
          </div>

          {/* Menu items */}
          <div className="py-1.5">
            <Link
              href="/dashboard/settings#icp"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-warm-600 hover:bg-warm-50 transition-colors"
            >
              <Target className="w-4 h-4 text-warm-400" strokeWidth={1.8} />
              View & Edit ICP
            </Link>
            <Link
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-warm-600 hover:bg-warm-50 transition-colors"
            >
              <Settings className="w-4 h-4 text-warm-400" strokeWidth={1.8} />
              Profile & Settings
            </Link>
            <Link
              href="/dashboard/settings#billing"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-warm-600 hover:bg-warm-50 transition-colors"
            >
              <CreditCard className="w-4 h-4 text-warm-400" strokeWidth={1.8} />
              Billing & Credits
            </Link>
            <Link
              href="/dashboard/settings#usage"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-warm-600 hover:bg-warm-50 transition-colors"
            >
              <BarChart3 className="w-4 h-4 text-warm-400" strokeWidth={1.8} />
              Usage & Limits
            </Link>
          </div>

          {/* Sign out */}
          <div className="border-t border-warm-100 py-1.5">
            <button
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-warm-400 hover:text-foreground hover:bg-warm-50 transition-colors w-full"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.8} />
              Log out
            </button>
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-warm-100 transition-all duration-200 w-full group"
      >
        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-accent">{initials}</span>
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-[13px] font-medium text-foreground truncate">
            {displayName}
            {companyName && (
              <span className="text-warm-400"> &middot; {companyName}</span>
            )}
          </p>
        </div>
        <ChevronUp
          className={`w-4 h-4 text-warm-400 transition-transform duration-200 ${
            open ? "rotate-0" : "rotate-180"
          }`}
          strokeWidth={1.8}
        />
      </button>
    </div>
  );
}
