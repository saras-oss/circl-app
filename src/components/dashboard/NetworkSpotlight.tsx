"use client";

import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";

const CACHE_KEY = "circl_network_spotlight";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface CachedSpotlight {
  text: string;
  timestamp: number;
}

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

export default function NetworkSpotlight() {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Check sessionStorage cache first
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: CachedSpotlight = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_TTL) {
          setText(parsed.text);
          setLoading(false);
          return;
        }
        sessionStorage.removeItem(CACHE_KEY);
      }
    } catch {
      // ignore storage errors
    }

    // Fetch from API
    const controller = new AbortController();

    fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question:
          "Give me a 2-3 sentence executive summary of my network. Mention how many total connections I have, the top industry, and one standout insight about seniority or geography. Keep it punchy.",
      }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data) => {
        if (data.text) {
          setText(data.text);
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
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(true);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  // Silent hide on error
  if (error) return null;

  // Loading skeleton
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-[#0ABF53]" strokeWidth={1.5} />
          <span className="text-sm font-semibold text-[#0A2540]">
            Network Spotlight
          </span>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-[#F0F3F7] rounded-full animate-pulse w-full" />
          <div className="h-3 bg-[#F0F3F7] rounded-full animate-pulse w-4/5" />
          <div className="h-3 bg-[#F0F3F7] rounded-full animate-pulse w-3/5" />
        </div>
      </div>
    );
  }

  if (!text) return null;

  return (
    <div className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm p-5">
      <h3 className="text-sm font-semibold text-[#0A2540] mb-2 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#0ABF53]" strokeWidth={1.5} />
        Network Spotlight
      </h3>
      <p className="text-sm text-[#596780] leading-relaxed">
        {renderBold(text)}
      </p>
    </div>
  );
}
