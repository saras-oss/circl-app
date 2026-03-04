"use client";

import { useState, useEffect } from "react";
import { Search, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";

const suggestedPrompts = [
  "Who are the founders in my network?",
  "Connections at companies that recently raised funding",
  "VCs and angel investors in my connections",
  "Senior leaders who could be advisors",
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
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Query Your Network</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search your connections using natural language
        </p>
      </div>

      {/* Search box */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={suggestedPrompts[promptIndex]}
            className="w-full h-14 pl-12 pr-24 rounded-2xl border-2 border-border bg-white text-sm focus:outline-none focus:border-primary transition-colors"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Suggested prompts */}
      <div className="mb-8">
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" />
          Try these queries
        </h3>
        <div className="flex flex-wrap gap-2">
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => setQuery(prompt)}
              className="text-xs px-4 py-2.5 rounded-full bg-white border hover:border-primary/30 hover:bg-muted transition-colors text-left"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Coming soon state */}
      <div className="bg-white rounded-2xl border p-12 text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <Search className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">
          Natural Language Query Engine
        </h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Type questions like &quot;Indian CTOs at Series B+
          healthcare companies&quot; or &quot;VCs who invest in fintech&quot;
          and get instant results from your network.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-xs font-medium text-muted-foreground">
          <Sparkles className="w-3 h-3" />
          Coming in Phase 2
        </div>
      </div>
    </div>
  );
}
