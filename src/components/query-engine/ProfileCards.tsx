"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  MapPin,
  Briefcase,
  Building2,
  ExternalLink,
  GraduationCap,
  Calendar,
} from "lucide-react";

function getScoreColor(score: number | null) {
  if (!score) return "bg-[#96A0B5]";
  if (score >= 9) return "bg-gradient-to-r from-[#0ABF53] to-[#34D399]";
  if (score >= 7) return "bg-[#0ABF53]";
  if (score >= 5) return "bg-[#FFBB38]";
  return "bg-[#96A0B5]";
}

function getScoreLabel(score: number | null) {
  if (!score) return "";
  if (score >= 9) return "Exceptional";
  if (score >= 7) return "Strong";
  if (score >= 5) return "Moderate";
  return "Low";
}

function initials(first?: string, last?: string) {
  return ((first?.[0] || "") + (last?.[0] || "")).toUpperCase() || "?";
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

interface ProfileCardsProps {
  results: any[];
}

export default function ProfileCards({ results }: ProfileCardsProps) {
  return (
    <div className="space-y-4">
      {results.map((r: any, i: number) => (
        <div
          key={r.connection_id || i}
          className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] overflow-hidden"
        >
          <div className="p-5 sm:p-6">
            {/* Top row: avatar + name + score */}
            <div className="flex items-start gap-4">
              {r.profile_pic_url ? (
                <img
                  src={r.profile_pic_url}
                  alt=""
                  className="w-14 h-14 rounded-xl object-cover shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-[#E6F9EE] flex items-center justify-center text-[#0ABF53] font-bold text-lg shrink-0">
                  {initials(r.first_name, r.last_name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-[#0A2540] truncate">
                      {r.first_name} {r.last_name}
                    </h3>
                    <p className="text-sm text-[#596780] truncate">
                      {r.current_title || r.csv_position || "—"}
                      {(r.current_company || r.csv_company) &&
                        ` at ${r.current_company || r.csv_company}`}
                    </p>
                  </div>
                  {r.match_score != null && (
                    <span
                      className={`${getScoreColor(r.match_score)} text-white text-xs font-bold px-2.5 py-1 rounded-lg shrink-0`}
                    >
                      {r.match_score}/10 · {getScoreLabel(r.match_score)}
                    </span>
                  )}
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-[#596780]">
                  {r.location_str && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {r.location_str}
                    </span>
                  )}
                  {r.total_experience_years != null && (
                    <span className="inline-flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5" />{" "}
                      {r.total_experience_years} years
                    </span>
                  )}
                  {r.company_industry && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />{" "}
                      {r.company_industry}
                    </span>
                  )}
                  {r.connected_on && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Connected{" "}
                      {formatDate(r.connected_on)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Match reasons */}
            {r.match_reasons && (
              <div className="mt-4 bg-[#F6F8FA] rounded-lg p-3">
                <p className="text-xs font-semibold text-[#0A2540] mb-1">
                  Why this match
                </p>
                {Array.isArray(r.match_reasons) ? (
                  <ul className="text-sm text-[#596780] space-y-0.5 list-disc list-inside">
                    {r.match_reasons.map((reason: string, j: number) => (
                      <li key={j}>{reason}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[#596780]">{r.match_reasons}</p>
                )}
              </div>
            )}

            {/* Suggested approach */}
            {r.suggested_approach && (
              <p className="mt-3 text-sm text-[#596780] italic">
                {r.suggested_approach}
              </p>
            )}

            {/* Extra details */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-[#96A0B5]">
              {r.previous_companies?.length > 0 && (
                <span>
                  Previously: {r.previous_companies.slice(0, 3).join(", ")}
                </span>
              )}
              {r.education_schools?.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5" />{" "}
                  {r.education_schools.slice(0, 2).join(", ")}
                </span>
              )}
            </div>

            {/* Company details + LinkedIn link */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#E3E8EF]">
              <div className="flex flex-wrap gap-2 text-xs text-[#596780]">
                {r.company_name && (
                  <span className="px-2 py-1 bg-[#F0F3F7] rounded">
                    {r.company_name}
                  </span>
                )}
                {r.company_size_min != null && r.company_size_max != null && (
                  <span className="px-2 py-1 bg-[#F0F3F7] rounded">
                    {r.company_size_min}-{r.company_size_max} employees
                  </span>
                )}
                {r.latest_funding_type && (
                  <span className="px-2 py-1 bg-[#F0F3F7] rounded">
                    {r.latest_funding_type}
                  </span>
                )}
              </div>
              {r.linkedin_url && (
                <a
                  href={r.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#96A0B5] hover:text-[#0ABF53] transition-colors shrink-0 ml-2"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
