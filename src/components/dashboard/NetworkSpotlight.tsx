"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw } from "lucide-react";

const THEME_LABELS: Record<string, string> = {
  founders_funded: "Founders at Funded Companies",
  career_movers: "Recent Career Movers",
  dormant_gold: "Dormant Gold",
  company_stages: "Company Stage Mix",
  investor_overlap: "Investor Network",
};

const THEME_COLORS: Record<string, string> = {
  founders_funded: "bg-green-100 text-green-700",
  career_movers: "bg-blue-100 text-blue-700",
  dormant_gold: "bg-amber-100 text-amber-700",
  company_stages: "bg-purple-100 text-purple-700",
  investor_overlap: "bg-teal-100 text-teal-700",
};

interface SpotlightResponse {
  text: string;
  themeId: string;
  themeTitle: string;
  totalViableThemes: number;
  viableThemeIds: string[];
}

export default function NetworkSpotlight() {
  const [data, setData] = useState<SpotlightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentThemeIndex, setCurrentThemeIndex] = useState(0);

  const fetchSpotlight = useCallback(async (themeIndex?: number) => {
    const cacheKey = `circl-spotlight-v4-${themeIndex ?? "default"}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
          setData(parsed.data);
          setLoading(false);
          return;
        }
      }
    } catch {
      // ignore storage errors
    }

    try {
      setLoading(true);
      setError(false);

      const res = await fetch("/api/dashboard-spotlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeIndex: themeIndex ?? null }),
      });

      if (!res.ok) {
        console.error("Spotlight error:", res.status, await res.text());
        setError(true);
        return;
      }

      const result = await res.json();
      if (result.text) {
        setData(result);
        try {
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({ data: result, timestamp: Date.now() })
          );
        } catch {
          // ignore storage errors
        }
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Spotlight fetch error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpotlight();
  }, [fetchSpotlight]);

  const handleNewInsight = () => {
    if (!data) return;
    const nextIndex = (currentThemeIndex + 1) % (data.totalViableThemes || 1);
    setCurrentThemeIndex(nextIndex);
    setData(null);
    setLoading(true);
    for (let i = 0; i < (data.totalViableThemes || 5); i++) {
      sessionStorage.removeItem(`circl-spotlight-v4-${i}`);
    }
    sessionStorage.removeItem("circl-spotlight-v4-default");
    fetchSpotlight(nextIndex);
  };

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-[#0ABF53]" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-[#0A2540]">
            Network Spotlight
          </h3>
        </div>
        <p className="text-sm text-[#96A0B5]">
          Couldn&apos;t generate insights right now.
        </p>
        <button
          onClick={() => {
            setError(false);
            fetchSpotlight();
          }}
          className="text-xs text-[#0ABF53] hover:text-[#089E45] mt-2 flex items-center gap-1 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-[#0ABF53]" strokeWidth={1.5} />
        <h3 className="text-sm font-semibold text-[#0A2540]">
          Network Spotlight
        </h3>
        {data?.themeId && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${THEME_COLORS[data.themeId] || "bg-[#F0F3F7] text-[#596780]"}`}
          >
            {THEME_LABELS[data.themeId] || data.themeTitle}
          </span>
        )}
        <div className="flex-1" />
        {!loading && data && (
          <button
            onClick={handleNewInsight}
            className="text-xs text-[#96A0B5] hover:text-[#596780] transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            New insight
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-[#F0F3F7] rounded w-full" />
          <div className="h-4 bg-[#F0F3F7] rounded w-11/12" />
          <div className="h-4 bg-[#F0F3F7] rounded w-full" />
          <div className="h-4 bg-[#F0F3F7] rounded w-10/12" />
          <div className="h-4 bg-[#F0F3F7] rounded w-full" />
          <div className="h-4 bg-[#F0F3F7] rounded w-9/12" />
        </div>
      ) : data?.text ? (
        <div className="text-sm text-[#596780] leading-relaxed space-y-3">
          {data.text.split("\n\n").map((paragraph, i) => (
            <p
              key={i}
              dangerouslySetInnerHTML={{
                __html: paragraph
                  .replace(
                    /\*\*(.*?)\*\*/g,
                    '<strong class="font-semibold text-[#0A2540]">$1</strong>'
                  )
                  .replace(/\n/g, "<br />"),
              }}
            />
          ))}
        </div>
      ) : null}

      {/* Theme indicator dots */}
      {data && data.totalViableThemes > 1 && !loading && (
        <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-[#F0F3F7]">
          {data.viableThemeIds.map((id) => (
            <div
              key={id}
              className={`w-1.5 h-1.5 rounded-full transition ${
                id === data.themeId ? "bg-[#0ABF53]" : "bg-[#E3E8EF]"
              }`}
            />
          ))}
          <span className="text-[10px] text-[#96A0B5] ml-1">
            {(data.viableThemeIds.indexOf(data.themeId) + 1)} of{" "}
            {data.totalViableThemes} insights
          </span>
        </div>
      )}
    </div>
  );
}
