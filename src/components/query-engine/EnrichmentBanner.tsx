"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";

interface EnrichmentBannerProps {
  coverage: { enriched: number; total: number } | undefined;
}

export default function EnrichmentBanner({ coverage }: EnrichmentBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!coverage || dismissed) return null;
  if (coverage.enriched >= coverage.total) return null;

  const pct = Math.round((coverage.enriched / coverage.total) * 100);

  return (
    <div className="flex items-center gap-3 rounded-lg bg-[#FFF8E6] border border-[#FFBB38]/20 px-4 py-3 mb-6">
      <Info className="w-4 h-4 text-[#B8860B] shrink-0" />
      <p className="text-sm text-[#B8860B] flex-1">
        Your network is {pct}% enriched — results may be incomplete.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-[#B8860B]/60 hover:text-[#B8860B] transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
