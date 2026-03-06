"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw } from "lucide-react";

const CACHE_KEY = "circl-spotlight-v3";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/** Parse markdown bold (**text**) into <strong> tags */
function renderBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-[#0A2540]">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

const LOADING_MESSAGES = [
  "Scanning your connections…",
  "Finding high-value contacts…",
  "Spotting hidden opportunities…",
  "Crafting your briefing…",
];

export default function NetworkSpotlight() {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);

  // Cycle through loading messages
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingMsg((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [loading]);

  const fetchSpotlight = useCallback(async () => {
    // Check cache first
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { text, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          setInsight(text);
          setLoading(false);
          return;
        }
      }
    } catch {
      // ignore storage errors
    }

    try {
      setLoading(true);
      setLoadingMsg(0);
      setError(false);

      const res = await fetch("/api/dashboard-spotlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        console.error("Spotlight API error:", res.status, await res.text());
        setError(true);
        return;
      }

      const data = await res.json();

      if (data.text) {
        setInsight(data.text);
        try {
          sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ text: data.text, timestamp: Date.now() })
          );
        } catch {
          // ignore storage errors
        }
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpotlight();
  }, [fetchSpotlight]);

  // Error fallback with retry
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-[#0ABF53]" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-[#0A2540]">Network Spotlight</h3>
        </div>
        <p className="text-sm text-[#96A0B5]">
          Couldn&apos;t generate insights right now.
        </p>
        <button
          onClick={() => {
            sessionStorage.removeItem(CACHE_KEY);
            setError(false);
            setLoading(true);
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

  // Loading state with progress bar and rotating messages
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-[#0ABF53]" strokeWidth={1.5} />
          <span className="text-sm font-semibold text-[#0A2540]">
            Network Spotlight
          </span>
          <span className="text-[10px] text-[#96A0B5] bg-[#F0F3F7] px-2 py-0.5 rounded-full">AI-generated</span>
        </div>
        <p className="text-sm text-[#596780] mb-3 transition-opacity duration-300">
          {LOADING_MESSAGES[loadingMsg]}
        </p>
        <div className="h-1.5 bg-[#F0F3F7] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full animate-spotlight-bar"
            style={{ background: "linear-gradient(90deg, #0ABF53, #34D399)" }}
          />
        </div>
        <style jsx>{`
          @keyframes spotlight-bar {
            0% { width: 0%; }
            50% { width: 70%; }
            100% { width: 95%; }
          }
          .animate-spotlight-bar {
            animation: spotlight-bar 8s ease-out forwards;
          }
        `}</style>
      </div>
    );
  }

  if (!insight) return null;

  return (
    <div className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-[#0ABF53]" strokeWidth={1.5} />
        <h3 className="text-sm font-semibold text-[#0A2540]">Network Spotlight</h3>
        <span className="text-[10px] text-[#96A0B5] bg-[#F0F3F7] px-2 py-0.5 rounded-full">AI-generated</span>
        <div className="flex-1" />
        <button
          onClick={() => {
            sessionStorage.removeItem(CACHE_KEY);
            setInsight(null);
            setLoading(true);
            setError(false);
            fetchSpotlight();
          }}
          className="text-xs text-[#96A0B5] hover:text-[#596780] transition-colors flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          New insight
        </button>
      </div>
      <p className="text-sm text-[#596780] leading-relaxed">
        {renderBold(insight)}
      </p>
    </div>
  );
}
