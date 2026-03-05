"use client";

import { Search } from "lucide-react";

const SUGGESTIONS = [
  "Who are the C-suite executives in my network?",
  "What does my network look like across industries?",
  "Show me connections at companies that recently raised funding",
  "Who are the investors and VCs in my network?",
  "Which companies have the most decision-makers in my network?",
  "Tell me about my strongest connections in the US",
];

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

export default function SuggestedQuestions({
  onSelect,
}: SuggestedQuestionsProps) {
  return (
    <div className="animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
      <p className="text-xs font-semibold uppercase tracking-wider text-[#96A0B5] mb-3">
        Try asking
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            className="flex items-center gap-3 text-left px-4 py-3 min-h-[44px] rounded-lg bg-white border border-[#E3E8EF] hover:border-[#0ABF53]/30 hover:bg-[#E6F9EE] hover:text-[#089E45] transition-all duration-200 text-[#596780] text-sm font-medium active:scale-[0.98]"
          >
            <Search className="w-4 h-4 shrink-0 opacity-40" />
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
