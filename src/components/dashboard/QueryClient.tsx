"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import type { QueryAPIResponse } from "@/lib/query-engine/types";
import QueryInput from "@/components/query-engine/QueryInput";
import SuggestedQuestions from "@/components/query-engine/SuggestedQuestions";
import QueryResult from "@/components/query-engine/QueryResult";
import EnrichmentBanner from "@/components/query-engine/EnrichmentBanner";

export default function QueryClient({ userId }: { userId: string }) {
  const searchParams = useSearchParams();
  const [question, setQuestion] = useState(searchParams.get("q") || "");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QueryAPIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoSubmitDone = useRef(false);

  const submitQuery = useCallback(async (queryText: string) => {
    if (!queryText.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: queryText }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const data: QueryAPIResponse = await res.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-submit if ?q= param is present
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoSubmitDone.current) {
      autoSubmitDone.current = true;
      submitQuery(q);
    }
  }, [searchParams, submitQuery]);

  function handleSubmit() {
    submitQuery(question);
  }

  function handleQuestionSelect(q: string) {
    setQuestion(q);
    submitQuery(q);
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-semibold text-[#0A2540]">Ask Circl</h1>
          <Sparkles className="w-5 h-5 text-[#0ABF53]" />
        </div>
        <p className="text-sm text-[#596780] font-medium">
          Ask anything about your network
        </p>
      </div>

      {/* Query input + enrichment note */}
      <div
        className="mb-8 animate-fade-in-up"
        style={{ animationDelay: "0.05s" }}
      >
        <QueryInput
          value={question}
          onChange={setQuestion}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
        <EnrichmentBanner coverage={result?.enrichment_coverage} />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl bg-[#FDE8EC] border border-[#ED5F74]/20 px-5 py-4 text-sm text-[#ED5F74] font-medium animate-fade-in">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-5">
            <div className="h-4 w-3/4 rounded-lg animate-shimmer mb-3" />
            <div className="h-4 w-1/2 rounded-lg animate-shimmer" />
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg animate-shimmer shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 rounded animate-shimmer" />
                  <div className="h-3 w-56 rounded animate-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results or suggestions */}
      {!isLoading && result ? (
        <QueryResult result={result} question={question} onFollowUp={handleQuestionSelect} />
      ) : (
        !isLoading && !error && (
          <SuggestedQuestions onSelect={handleQuestionSelect} />
        )
      )}
    </div>
  );
}
