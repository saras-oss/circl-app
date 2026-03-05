"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  MapPin,
  Briefcase,
  Building2,
  ExternalLink,
  GraduationCap,
  Calendar,
  Factory,
  Globe,
  Users,
  ArrowRight,
} from "lucide-react";

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

function formatFunding(amount: number | null): string {
  if (!amount) return "";
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(0)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

function extractDomain(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

/** Parse work_history JSONB into displayable career entries */
function parseWorkHistory(wh: any): { company: string; title: string; startYear: string; endYear: string }[] {
  if (!wh) return [];
  let entries: any[] = [];
  try {
    const parsed = typeof wh === "string" ? JSON.parse(wh) : wh;
    entries = Array.isArray(parsed) ? parsed : [];
  } catch {
    entries = [];
  }
  return entries
    .map((e: any) => ({
      company: e.company || e.company_name || "",
      title: e.title || e.position || "",
      startYear: e.starts_at?.year?.toString() || e.start_year?.toString() || "",
      endYear: e.ends_at?.year?.toString() || e.end_year?.toString() || "present",
    }))
    .filter((e) => e.company)
    .slice(0, 4);
}

/** Zip education arrays into displayable entries */
function parseEducation(schools: any, degrees: any, fields: any): { school: string; degree: string }[] {
  let schoolArr: string[] = [];
  try {
    const parsed = typeof schools === "string" ? JSON.parse(schools) : schools;
    schoolArr = Array.isArray(parsed) ? parsed : [];
  } catch {
    schoolArr = [];
  }
  if (schoolArr.length === 0) return [];
  const degreeArr = Array.isArray(degrees) ? degrees : [];
  const fieldArr = Array.isArray(fields) ? fields : [];
  return schoolArr.slice(0, 2).map((school: string, i: number) => {
    const parts = [degreeArr[i], fieldArr[i]].filter(Boolean);
    return { school, degree: parts.join(" in ") };
  });
}

/** Parse match_reasons JSONB safely */
function parseMatchReasons(mr: any): string {
  if (!mr) return "";
  try {
    const parsed = typeof mr === "string" ? JSON.parse(mr) : mr;
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed)) return parsed.join(". ");
    if (parsed?.reasons) return Array.isArray(parsed.reasons) ? parsed.reasons.join(". ") : parsed.reasons;
    if (parsed?.text) return parsed.text;
    return JSON.stringify(parsed);
  } catch {
    return typeof mr === "string" ? mr : "";
  }
}

interface ProfileCardsProps {
  results: any[];
}

export default function ProfileCards({ results }: ProfileCardsProps) {
  return (
    <div className="space-y-4">
      {results.map((r: any, i: number) => {
        const workHistory = parseWorkHistory(r.work_history);
        const education = parseEducation(r.education_schools, r.education_degrees, r.education_fields);
        const hasCompanyData = r.company_name || r.company_industry || r.company_size_min != null || r.company_type || r.latest_funding_type || r.company_website;
        const whArr = (() => { try { const p = typeof r.work_history === "string" ? JSON.parse(r.work_history) : r.work_history; return Array.isArray(p) ? p : []; } catch { return []; } })();
        const remainingRoles = whArr.length > 4 ? whArr.length - 4 : 0;

        return (
          <div
            key={r.connection_id || i}
            className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] overflow-hidden"
          >
            <div className="p-5 sm:p-6">
              {/* ── Header Row ── */}
              <div className="flex items-start gap-4">
                {r.profile_pic_url ? (
                  <img
                    src={r.profile_pic_url}
                    alt=""
                    className="w-14 h-14 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${getAvatarColor(r.first_name, r.last_name)}`}
                  >
                    {initials(r.first_name, r.last_name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-[#0A2540] truncate">
                          {r.first_name} {r.last_name}
                        </h3>
                        {r.linkedin_url && (
                          <a
                            href={r.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#96A0B5] hover:text-[#0ABF53] transition-colors shrink-0"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                      <p className="text-sm text-[#596780]">
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

                  {/* ── Meta Row ── */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-[#596780]">
                    {r.location_str && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {r.location_str}
                      </span>
                    )}
                    {(r.company_size_min != null || r.company_size_max != null) && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />{" "}
                        {r.company_size_min && r.company_size_max
                          ? `${r.company_size_min.toLocaleString()}–${r.company_size_max.toLocaleString()} employees`
                          : `${(r.company_size_max || r.company_size_min || 0).toLocaleString()}+ employees`}
                      </span>
                    )}
                    {r.total_experience_years != null && (
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5" />{" "}
                        {r.total_experience_years} years
                      </span>
                    )}
                    {r.connected_on && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Connected{" "}
                        {formatDate(r.connected_on)}
                      </span>
                    )}
                    {r.company_industry && (
                      <span className="inline-flex items-center gap-1">
                        <Factory className="w-3.5 h-3.5" />{" "}
                        {r.company_industry}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Company Context Section ── */}
              {hasCompanyData && (
                <div className="mt-4 bg-[#F6F8FA] rounded-lg p-4">
                  <p className="text-xs font-medium text-[#96A0B5] uppercase tracking-wide mb-2">
                    Company
                  </p>
                  <div className="space-y-1.5 text-sm text-[#596780]">
                    {r.company_name && (
                      <p className="font-medium text-[#0A2540]">
                        {r.company_name}
                        {r.company_industry && (
                          <span className="font-normal text-[#596780]">
                            {" "}· {r.company_industry}
                          </span>
                        )}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {r.company_size_min != null && r.company_size_max != null && (
                        <span>{r.company_size_min.toLocaleString()}–{r.company_size_max.toLocaleString()} employees</span>
                      )}
                      {r.company_type && (
                        <span>{r.company_type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
                      )}
                      {r.latest_funding_type && (
                        <span>
                          {r.latest_funding_type}
                          {r.latest_funding_amount ? ` · ${formatFunding(r.latest_funding_amount)}` : ""}
                        </span>
                      )}
                      {r.total_funding_amount && (
                        <span>{formatFunding(r.total_funding_amount)} total raised</span>
                      )}
                    </div>
                    {r.company_website && (
                      <a
                        href={r.company_website.startsWith("http") ? r.company_website : `https://${r.company_website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#0ABF53] hover:underline"
                      >
                        <Globe className="w-3 h-3" />
                        {extractDomain(r.company_website)}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* ── Career Path Section ── */}
              {workHistory.length >= 2 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-[#96A0B5] uppercase tracking-wide mb-2">
                    Career Path
                  </p>
                  <div className="flex flex-wrap items-center gap-1 text-sm text-[#596780]">
                    {workHistory.map((entry, j) => (
                      <span key={j} className="inline-flex items-center gap-1">
                        {j > 0 && <ArrowRight className="w-3 h-3 text-[#96A0B5] shrink-0" />}
                        <span>
                          <span className="font-medium text-[#0A2540]">{entry.company}</span>
                          {entry.title && (
                            <span className="text-[#596780]"> ({entry.title}, {entry.startYear}–{entry.endYear})</span>
                          )}
                        </span>
                      </span>
                    ))}
                    {remainingRoles > 0 && (
                      <span className="text-xs text-[#96A0B5] ml-1">
                        and {remainingRoles} earlier {remainingRoles === 1 ? "role" : "roles"}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* ── Education Section ── */}
              {education.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-[#96A0B5] uppercase tracking-wide mb-2">
                    Education
                  </p>
                  <div className="space-y-1">
                    {education.map((edu, j) => (
                      <p key={j} className="text-sm text-[#596780]">
                        <GraduationCap className="w-3.5 h-3.5 inline mr-1 text-[#96A0B5]" />
                        <span className="font-medium text-[#0A2540]">{edu.school}</span>
                        {edu.degree && <span> — {edu.degree}</span>}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Match Analysis Section ── */}
              {r.match_score != null && r.match_reasons && (() => {
                const reasons = parseMatchReasons(r.match_reasons);
                if (!reasons) return null;
                return (
                  <div className="mt-4 bg-[#F6F8FA] rounded-lg p-4">
                    <p className="text-xs font-medium text-[#96A0B5] uppercase tracking-wide mb-2">
                      Why this match
                    </p>
                    <p className="text-sm text-[#596780]">{reasons}</p>
                  </div>
                );
              })()}

              {/* ── Suggested Approach Section ── */}
              {r.suggested_approach && (
                <p className="mt-3 text-sm text-[#596780] italic">
                  {r.suggested_approach}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
