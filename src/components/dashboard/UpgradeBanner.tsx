"use client";

import { ArrowRight, Sparkles } from "lucide-react";

export default function UpgradeBanner({
  totalConnections,
}: {
  totalConnections: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-warm-900 p-5 mb-6 animate-fade-in">
      {/* Subtle dot pattern */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)`,
        backgroundSize: '20px 20px'
      }} />
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-gold" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              {(totalConnections - 100).toLocaleString()} more connections waiting
            </p>
            <p className="text-xs text-warm-400 mt-0.5">
              Upgrade to analyze your full network
            </p>
          </div>
        </div>
        <a
          href="/dashboard/settings"
          className="shrink-0 h-10 px-5 flex items-center gap-2 rounded-xl bg-white text-warm-900 text-sm font-bold hover:bg-warm-100 transition-all active:scale-[0.97]"
        >
          Upgrade
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
