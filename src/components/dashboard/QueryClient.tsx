"use client";

import { useState, useEffect } from "react";
import { Search, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";

const suggestedPrompts = [
  "Who are the founders in my network?",
  "Connections at companies that recently raised funding",
  "VCs and angel investors in my connections",
  "Senior leaders in my industry",
  "Marketing directors at companies with 500+ employees",
  "Indian CTOs at Series B+ companies",
  "People who previously worked at McKinsey",
  "Founders I've been connected with for 5+ years",
];

export default function QueryClient({ userId }: { userId: string }) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [promptIndex, setPromptIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPromptIndex((prev) => (prev + 1) % suggestedPrompts.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Query engine will be built in Phase 2
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[#0A2540]">Query Your Network</h1>
        <p className="text-sm text-[#596780] mt-1 font-medium">
          Search your connections using natural language
        </p>
      </div>

      {/* Search box */}
      <form onSubmit={handleSubmit} className="mb-10 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#96A0B5]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={suggestedPrompts[promptIndex]}
            className="w-full h-[56px] pl-13 pr-28 bg-white border border-[#E3E8EF] rounded-lg text-sm font-medium text-[#0A2540] placeholder:text-[#96A0B5] focus:border-[#0ABF53] focus:ring-2 focus:ring-[#0ABF53]/20 outline-none transition-all"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-[44px] px-6 rounded-lg bg-gradient-to-r from-[#0ABF53] to-[#34D399] text-white text-sm font-semibold hover:opacity-90 transition-all duration-150 active:scale-[0.98]"
          >
            Search
          </button>
        </div>
      </form>

      {/* Suggested prompts */}
      <div className="mb-10 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#96A0B5] mb-3 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#0ABF53]" />
          Try these queries
        </p>
        <div className="flex flex-wrap gap-2 stagger-children">
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => setQuery(prompt)}
              className="text-xs font-medium px-4 py-2.5 min-h-[44px] rounded-full bg-white border border-[#E3E8EF] hover:border-[#0ABF53]/30 hover:bg-[#E6F9EE] hover:text-[#089E45] transition-all duration-200 text-[#596780] active:scale-[0.98]"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Coming soon state */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-10 sm:p-16 text-center relative overflow-hidden animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
        {/* Subtle decorative pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, #0A2540 1px, transparent 0)",
          backgroundSize: "24px 24px"
        }} />

        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#E6F9EE] to-[#0ABF53]/10 flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-9 h-9 text-[#0ABF53]" />
          </div>
          <h3 className="text-xl font-bold tracking-tight text-[#0A2540]">
            Natural Language Query Engine
          </h3>
          <p className="text-sm text-[#596780] mt-3 max-w-md mx-auto leading-relaxed">
            Type questions like &quot;Indian CTOs at Series B+
            healthcare companies&quot; or &quot;VCs who invest in fintech&quot;
            and get instant results from your network.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FFF8E6] text-[#B8860B] text-xs font-semibold border border-[#FFBB38]/20">
            <Sparkles className="w-3.5 h-3.5 text-[#FFBB38]" />
            Coming in Phase 2
          </div>
        </div>
      </div>
    </div>
  );
}
