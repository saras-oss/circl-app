"use client";

import { ArrowRight, Sparkles } from "lucide-react";

export default function UpgradeBanner({
  totalConnections,
}: {
  totalConnections: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-[#0A2540] p-5 mb-6 animate-fade-in">
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-[#FFBB38]" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {(totalConnections - 100).toLocaleString()} more connections waiting
            </p>
            <p className="text-xs text-[#96A0B5] mt-0.5">
              Upgrade to analyze your full network
            </p>
          </div>
        </div>
        <a
          href="/dashboard/settings"
          className="shrink-0 h-10 px-5 flex items-center gap-2 rounded-lg btn-primary-gradient text-sm font-medium"
        >
          Upgrade
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
