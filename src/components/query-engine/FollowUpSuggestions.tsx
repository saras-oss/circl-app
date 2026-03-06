"use client";

import { ArrowRight } from "lucide-react";

interface FollowUpSuggestionsProps {
  suggestions: string[];
  onSelect: (question: string) => void;
}

export default function FollowUpSuggestions({
  suggestions,
  onSelect,
}: FollowUpSuggestionsProps) {
  if (!suggestions.length) return null;

  return (
    <div className="pt-4 border-t border-[#E3E8EF]">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#96A0B5] mb-2">
        Follow up
      </p>
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-full bg-[#F6F8FA] border border-[#E3E8EF] hover:border-[#0ABF53]/30 hover:bg-[#E6F9EE] hover:text-[#089E45] text-[#596780] transition-all duration-200 active:scale-[0.98] text-left break-words"
          >
            {s}
            <ArrowRight className="w-3.5 h-3.5 opacity-50 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
