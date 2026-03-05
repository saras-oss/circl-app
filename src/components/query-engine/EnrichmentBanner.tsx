"use client";

interface EnrichmentBannerProps {
  coverage: { enriched: number; total: number } | undefined;
}

export default function EnrichmentBanner({ coverage }: EnrichmentBannerProps) {
  if (!coverage || coverage.enriched >= coverage.total) return null;

  return (
    <p className="text-xs text-[#96A0B5] text-center mt-2">
      Results based on {coverage.enriched.toLocaleString()} of{" "}
      {coverage.total.toLocaleString()} enriched connections
    </p>
  );
}
