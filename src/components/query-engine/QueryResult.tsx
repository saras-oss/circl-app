"use client";

import type { QueryAPIResponse } from "@/lib/query-engine/types";
import TextAnswer from "./TextAnswer";
import ProfileCards from "./ProfileCards";
import ConnectionCards from "./ConnectionCards";
import ConnectionTable from "./ConnectionTable";
import AggregateChart from "./AggregateChart";
import FollowUpSuggestions from "./FollowUpSuggestions";

interface QueryResultProps {
  result: QueryAPIResponse;
  onFollowUp: (question: string) => void;
}

export default function QueryResult({ result, onFollowUp }: QueryResultProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Text answer */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-5">
        <TextAnswer text={result.text} />
      </div>

      {/* Structured display */}
      {result.display_type === "profile" && result.results.length > 0 && (
        <ProfileCards results={result.results} />
      )}
      {result.display_type === "cards" && result.results.length > 0 && (
        <ConnectionCards results={result.results} />
      )}
      {result.display_type === "table" && result.results.length > 0 && (
        <ConnectionTable results={result.results} />
      )}
      {result.display_type === "chart" && result.aggregation && (
        <AggregateChart data={result.aggregation} />
      )}

      {/* Total count note */}
      {result.total_available > result.results.length && (
        <p className="text-xs text-[#96A0B5] text-center">
          Showing {result.results.length} of {result.total_available} matches
        </p>
      )}

      {/* Follow-up suggestions */}
      {result.follow_up_suggestions?.length > 0 && (
        <FollowUpSuggestions
          suggestions={result.follow_up_suggestions}
          onSelect={onFollowUp}
        />
      )}
    </div>
  );
}
