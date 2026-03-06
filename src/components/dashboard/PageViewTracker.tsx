"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PAGE_MAP: Record<string, string> = {
  dashboard: "dashboard",
  "hit-list": "hit-list",
  network: "network",
  ask: "ask",
  query: "ask",
  settings: "settings",
  admin: "admin",
};

export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const page = pathname.split("/").pop() || "dashboard";
    const pageName = PAGE_MAP[page] || page;

    fetch("/api/track/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: pageName }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
