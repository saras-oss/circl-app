"use client";

import { Search, ArrowRight, Loader2 } from "lucide-react";

interface QueryInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export default function QueryInput({
  value,
  onChange,
  onSubmit,
  isLoading,
}: QueryInputProps) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !isLoading && value.trim()) {
      onSubmit();
    }
  }

  return (
    <div className="relative">
      <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#96A0B5]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything about your network..."
        disabled={isLoading}
        className="w-full h-[52px] sm:h-[56px] pl-11 sm:pl-13 pr-14 sm:pr-16 bg-white border border-[#E3E8EF] rounded-xl text-[16px] sm:text-sm font-medium text-[#0A2540] placeholder:text-[#96A0B5] focus:border-[#0ABF53] focus:ring-2 focus:ring-[#0ABF53]/20 outline-none transition-all disabled:opacity-60 min-w-0"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={isLoading || !value.trim()}
        className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-[44px] sm:w-[44px] rounded-lg bg-[#0ABF53] text-white flex items-center justify-center hover:bg-[#089E45] transition-all duration-150 active:scale-[0.96] disabled:opacity-40 disabled:hover:bg-[#0ABF53] shrink-0"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <ArrowRight className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}
