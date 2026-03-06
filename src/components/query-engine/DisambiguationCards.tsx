"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { MapPin, ExternalLink } from "lucide-react";

function SmallAvatar({ src, first, last }: { src?: string; first?: string; last?: string }) {
  const [imgError, setImgError] = useState(false);
  if (src && !imgError) {
    return (
      <img
        src={src}
        alt=""
        className="w-11 h-11 rounded-full object-cover shrink-0"
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
      />
    );
  }
  return (
    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${getAvatarColor(first, last)}`}>
      {initials(first, last)}
    </div>
  );
}

const AVATAR_COLORS = [
  "bg-[#E6F9EE] text-[#0ABF53]",
  "bg-[#E8F0FE] text-[#4285F4]",
  "bg-[#FEF3E2] text-[#F59E0B]",
  "bg-[#F3E8FF] text-[#8B5CF6]",
  "bg-[#FDE8EC] text-[#ED5F74]",
  "bg-[#E0F2FE] text-[#0EA5E9]",
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getAvatarColor(first?: string, last?: string) {
  const name = `${first || ""}${last || ""}`;
  return AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length];
}

function initials(first?: string, last?: string) {
  return ((first?.[0] || "") + (last?.[0] || "")).toUpperCase() || "?";
}

function getScoreColor(score: number | null) {
  if (!score) return "bg-[#96A0B5]";
  if (score >= 9) return "bg-gradient-to-r from-[#0ABF53] to-[#34D399]";
  if (score >= 7) return "bg-[#0ABF53]";
  if (score >= 5) return "bg-[#FFBB38]";
  return "bg-[#96A0B5]";
}

interface DisambiguationCardsProps {
  results: any[];
  onSelect: (person: any) => void;
}

export default function DisambiguationCards({
  results,
  onSelect,
}: DisambiguationCardsProps) {
  return (
    <div className="space-y-2">
      {results.map((r: any, i: number) => (
        <button
          key={r.connection_id || i}
          onClick={() => onSelect(r)}
          className="w-full flex items-center gap-3 bg-white rounded-lg shadow-sm border border-[#E3E8EF] px-4 py-3 text-left cursor-pointer hover:bg-[#F6F8FA] hover:border-[#0ABF53]/30 transition-all"
        >
          <SmallAvatar src={r.profile_pic_url} first={r.first_name} last={r.last_name} />

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
                onClick={(e) => e.stopPropagation()}
                className="text-[#96A0B5] hover:text-[#0ABF53] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
