"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { MapPin, ExternalLink } from "lucide-react";

function getScoreColor(score: number | null) {
  if (!score) return "bg-[#96A0B5]";
  if (score >= 9) return "bg-gradient-to-r from-[#0ABF53] to-[#34D399]";
  if (score >= 7) return "bg-[#0ABF53]";
  if (score >= 5) return "bg-[#FFBB38]";
  return "bg-[#96A0B5]";
}

function initials(first?: string, last?: string) {
  return ((first?.[0] || "") + (last?.[0] || "")).toUpperCase() || "?";
}

interface ConnectionCardsProps {
  results: any[];
}

export default function ConnectionCards({ results }: ConnectionCardsProps) {
  return (
    <div className="space-y-2">
      {results.map((r: any, i: number) => (
        <div
          key={r.connection_id || i}
          className="flex items-center gap-3 bg-white rounded-lg shadow-sm border border-[#E3E8EF] px-4 py-3"
        >
          {r.profile_pic_url ? (
            <img
              src={r.profile_pic_url}
              alt=""
              className="w-10 h-10 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-[#E6F9EE] flex items-center justify-center text-[#0ABF53] font-bold text-xs shrink-0">
              {initials(r.first_name, r.last_name)}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#0A2540] truncate">
              {r.first_name} {r.last_name}
            </p>
            <p className="text-xs text-[#596780] truncate">
              {r.current_title || r.csv_position || "—"}
              {(r.current_company || r.csv_company) &&
                ` at ${r.current_company || r.csv_company}`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {r.location_str && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-[#96A0B5]">
                <MapPin className="w-3 h-3" />
                {r.city || r.location_str.split(",")[0]}
              </span>
            )}
            {r.company_industry && (
              <span className="hidden sm:inline-block text-xs px-2 py-0.5 bg-[#F0F3F7] rounded text-[#596780]">
                {r.company_industry}
              </span>
            )}
            {r.match_score != null && (
              <span
                className={`${getScoreColor(r.match_score)} text-white text-xs font-bold px-2 py-0.5 rounded-md`}
              >
                {r.match_score}
              </span>
            )}
            {r.linkedin_url && (
              <a
                href={r.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#96A0B5] hover:text-[#0ABF53] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
