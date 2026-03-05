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
    <div ref={ref} className="relative px-3 py-3 border-t border-[#F0F3F7]">
      {/* Popup menu */}
      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-xl border border-[#E3E8EF] shadow-lg overflow-hidden animate-fade-in-up z-50">
          {/* User info header */}
          <div className="px-4 py-3.5 border-b border-[#F0F3F7]">
            <p className="text-sm font-semibold text-[#0A2540] truncate">
              {userName || userEmail}
            </p>
            <p className="text-xs text-[#96A0B5] truncate mt-0.5">{userEmail}</p>
            {companyName && (
              <p className="text-xs text-[#96A0B5] truncate mt-0.5">
                {companyName}
              </p>
            )}
          </div>

          {/* Menu items */}
          <div className="py-1.5">
            <Link
              href="/dashboard/settings#icp"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-[#596780] hover:bg-[#F6F8FA] transition-colors"
            >
              <Target className="w-4 h-4 text-[#96A0B5]" strokeWidth={1.8} />
              View & Edit ICP
            </Link>
            <Link
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-[#596780] hover:bg-[#F6F8FA] transition-colors"
            >
              <Settings className="w-4 h-4 text-[#96A0B5]" strokeWidth={1.8} />
              Profile & Settings
            </Link>
            <Link
              href="/dashboard/settings#billing"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-[#596780] hover:bg-[#F6F8FA] transition-colors"
            >
              <CreditCard className="w-4 h-4 text-[#96A0B5]" strokeWidth={1.8} />
              Billing & Credits
            </Link>
            <Link
              href="/dashboard/settings#usage"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-[#596780] hover:bg-[#F6F8FA] transition-colors"
            >
              <BarChart3 className="w-4 h-4 text-[#96A0B5]" strokeWidth={1.8} />
              Usage & Limits
            </Link>
          </div>

          {/* Sign out */}
          <div className="border-t border-[#F0F3F7] py-1.5">
            <button
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-[#96A0B5] hover:text-[#0A2540] hover:bg-[#F6F8FA] transition-colors w-full"
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
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#F6F8FA] transition-all duration-200 w-full group"
      >
        <div className="w-8 h-8 rounded-full bg-[#E6F9EE] flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-[#0ABF53]">{initials}</span>
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-[13px] font-medium text-[#0A2540] truncate">
            {displayName}
            {companyName && (
              <span className="text-[#96A0B5]"> &middot; {companyName}</span>
            )}
          </p>
        </div>
        <ChevronUp
          className={`w-4 h-4 text-[#96A0B5] transition-transform duration-200 ${
            open ? "rotate-0" : "rotate-180"
          }`}
          strokeWidth={1.8}
        />
      </button>
    </div>
  );
}
