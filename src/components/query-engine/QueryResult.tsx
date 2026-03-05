"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import type { QueryAPIResponse } from "@/lib/query-engine/types";
import TextAnswer from "./TextAnswer";
import ProfileCards from "./ProfileCards";
import DisambiguationCards from "./DisambiguationCards";
import ConnectionTable from "./ConnectionTable";
import AggregateChart from "./AggregateChart";
import FollowUpSuggestions from "./FollowUpSuggestions";

interface QueryResultProps {
  result: QueryAPIResponse;
  onFollowUp: (question: string) => void;
}

export default function QueryResult({ result, onFollowUp }: QueryResultProps) {
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);

  // Reset selected person whenever a new result comes in
  useEffect(() => {
    setSelectedPerson(null);
  }, [result]);

  const salesIntent = result?.sales_intent || false;

  function renderIntroGrouped() {
    if (!result.is_intro_query || !result.intro_company) return null;

    const companyName = result.intro_company.toLowerCase();

    const currentEmployees = result.results.filter((r: any) => {
      const current = (r.current_company || r.csv_company || "").toLowerCase();
      const compName = (r.company_name || "").toLowerCase();
      return current.includes(companyName) || compName.includes(companyName);
    });

    const formerEmployees = result.results.filter((r: any) => {
      const current = (r.current_company || r.csv_company || "").toLowerCase();
      const compName = (r.company_name || "").toLowerCase();
      return !current.includes(companyName) && !compName.includes(companyName);
    });

    return (
      <div className="space-y-6 mt-4">
        {currentEmployees.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-[#596780] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-[#0ABF53] rounded-full"></span>
              Currently at {result.intro_company} ({currentEmployees.length})
            </h3>
            <ProfileCards results={currentEmployees} salesIntent={salesIntent} />
          </div>
        )}
        {formerEmployees.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-[#596780] mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-[#FFBB38] rounded-full"></span>
              Previously at {result.intro_company} ({formerEmployees.length})
            </h3>
            <ProfileCards results={formerEmployees} salesIntent={salesIntent} />
          </div>
        )}
      </div>
    );
  }

  function renderStructuredDisplay() {
    // Intro-to-company grouping (current vs previous)
    if (result.is_intro_query && result.intro_company && result.results.length > 0) {
      return renderIntroGrouped();
    }

    // Profile display type — person lookup
    if (result.display_type === "profile" && result.results.length > 0) {
      if (result.results.length === 1) {
        return <ProfileCards results={result.results} salesIntent={salesIntent} />;
      } else if (selectedPerson) {
        return (
          <div>
            <button
              onClick={() => setSelectedPerson(null)}
              className="inline-flex items-center gap-1 text-sm text-[#596780] hover:text-[#0ABF53] transition-colors mb-3"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to all results
            </button>
            <ProfileCards results={[selectedPerson]} salesIntent={salesIntent} />
          </div>
        );
      } else {
        return (
          <DisambiguationCards
            results={result.results}
            onSelect={setSelectedPerson}
          />
        );
      }
    }

    // Cards display type (1-5 filter results) → use rich ProfileCards
    if (result.display_type === "cards" && result.results.length > 0) {
      return <ProfileCards results={result.results} salesIntent={salesIntent} />;
    }

    // Table display type (6+ filter results)
    if (result.display_type === "table" && result.results.length > 0) {
      return <ConnectionTable results={result.results} salesIntent={salesIntent} />;
    }

    // Chart display type (aggregation)
    if (result.display_type === "chart" && result.aggregation) {
      return <AggregateChart data={result.aggregation} />;
    }

    return null;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Text answer */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-5">
        <TextAnswer text={result.text} />
      </div>

      {/* Structured display */}
      {renderStructuredDisplay()}

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
