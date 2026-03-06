"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MapPin,
  Briefcase,
  Factory,
  Calendar,
  Building2,
} from "lucide-react";

function getScoreColor(score: number | null) {
  if (!score) return "bg-[#96A0B5]";
  if (score >= 9) return "bg-gradient-to-r from-[#0ABF53] to-[#34D399]";
  if (score >= 7) return "bg-[#0ABF53]";
  if (score >= 5) return "bg-[#FFBB38]";
  return "bg-[#96A0B5]";
}

function formatFunding(amount: number | null): string {
  if (!amount) return "";
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${Math.round(amount / 1_000_000)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${amount}`;
}

function parseJsonField(field: any): any[] {
  if (!field) return [];
  try {
    const parsed = typeof field === "string" ? JSON.parse(field) : field;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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

type SortField = "name" | "title" | "company" | "industry" | "score" | "location";
type SortDir = "asc" | "desc";

interface ConnectionTableProps {
  results: any[];
  salesIntent?: boolean;
}

export default function ConnectionTable({ results, salesIntent = false }: ConnectionTableProps) {
  const [sortField, setSortField] = useState<SortField>(salesIntent ? "score" : "name");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function getValue(r: any, field: SortField): string | number {
    switch (field) {
      case "name":
        return `${r.first_name || ""} ${r.last_name || ""}`.toLowerCase();
      case "title":
        return (r.current_title || r.csv_position || "").toLowerCase();
      case "company":
        return (r.current_company || r.csv_company || "").toLowerCase();
      case "industry":
        return (r.company_industry || "").toLowerCase();
      case "score":
        return r.match_score ?? -1;
      case "location":
        return (r.city || r.location_str || "").toLowerCase();
    }
  }

  const sorted = [...results].sort((a, b) => {
    const va = getValue(a, sortField);
    const vb = getValue(b, sortField);
    const cmp = typeof va === "number" ? va - (vb as number) : (va as string).localeCompare(vb as string);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3.5 h-3.5 inline ml-0.5" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 inline ml-0.5" />
    );
  };

  const thClass =
    "text-left text-xs font-semibold text-[#96A0B5] uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-[#0A2540] transition-colors select-none";

  const lastColumnField = salesIntent ? "score" : "location";
  const lastColumnLabel = salesIntent ? "Score" : "Location";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] overflow-hidden -mx-4 sm:mx-0 rounded-none sm:rounded-xl">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-[#E3E8EF]">
            <tr>
              <th className={thClass} onClick={() => handleSort("name")}>
                Name <SortIcon field="name" />
              </th>
              <th className={thClass} onClick={() => handleSort("title")}>
                Title <SortIcon field="title" />
              </th>
              <th className={thClass} onClick={() => handleSort("company")}>
                Company <SortIcon field="company" />
              </th>
              <th
                className={`${thClass} hidden sm:table-cell`}
                onClick={() => handleSort("industry")}
              >
                Industry <SortIcon field="industry" />
              </th>
              <th
                className={thClass}
                onClick={() => handleSort(lastColumnField)}
              >
                {lastColumnLabel} <SortIcon field={lastColumnField} />
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r: any, i: number) => {
              const id = r.connection_id || String(i);
              const isExpanded = expandedId === id;
              const workHistory = parseJsonField(r.work_history)
                .map((e: any) => ({
                  company: e.company || e.company_name || "",
                  title: e.title || e.position || "",
                  startYear: e.starts_at?.year?.toString() || e.start_year?.toString() || "",
                  endYear: e.ends_at?.year?.toString() || e.end_year?.toString() || "present",
                }))
                .filter((e: any) => e.company)
                .slice(0, 2);

              return (
                <tr key={id} className="group">
                  <td colSpan={6} className="p-0">
                    <div
                      className="flex items-center px-4 py-3 cursor-pointer hover:bg-[#F6F8FA] transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : id)}
                    >
                      <div className="flex-1 grid grid-cols-[1fr_1fr_1fr_1fr] sm:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-x-4 items-center min-w-[600px]">
                        <span className="text-sm font-medium text-[#0A2540] truncate">
                          {r.first_name} {r.last_name}
                        </span>
                        <span className="text-sm text-[#596780] truncate">
                          {r.current_title || r.csv_position || "—"}
                        </span>
                        <span className="text-sm text-[#596780] truncate">
                          {r.current_company || r.csv_company || "—"}
                        </span>
                        <span className="text-sm text-[#596780] truncate hidden sm:block">
                          {r.company_industry || "—"}
                        </span>
                        {salesIntent ? (
                          r.match_score != null ? (
                            <span
                              className={`${getScoreColor(r.match_score)} text-white text-xs font-bold px-2 py-0.5 rounded-md w-fit`}
                            >
                              {r.match_score}
                            </span>
                          ) : (
                            <span className="text-xs text-[#96A0B5]">—</span>
                          )
                        ) : (
                          <span className="text-sm text-[#596780] truncate">
                            {r.city || r.location_str || "—"}
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
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-4 bg-[#F6F8FA] border-t border-[#E3E8EF]">
                        <div className="pt-3 space-y-2 text-sm text-[#596780]">
                          {/* Meta row */}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#596780]">
                            {r.location_str && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {r.location_str}
                              </span>
                            )}
                            {r.total_experience_years != null && (
                              <span className="inline-flex items-center gap-1">
                                <Briefcase className="w-3 h-3" /> {r.total_experience_years} years of experience
                              </span>
                            )}
                            {r.connected_on && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Connected{" "}
                                {new Date(r.connected_on).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                              </span>
                            )}
                          </div>
                          {/* Career — last 2 roles */}
                          {workHistory.length > 0 && (
                            <div className="text-xs text-[#596780]">
                              {workHistory.map((entry, j) => (
                                <p key={j}>
                                  Previously: <span className="font-medium text-[#0A2540]">{entry.title}</span> at {entry.company}
                                  {entry.startYear && ` (${entry.startYear}–${entry.endYear})`}
                                </p>
                              ))}
                            </div>
                          )}
                          {/* Company context */}
                          {(r.company_industry || r.company_size_min != null || r.company_type || r.latest_funding_type) && (
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#596780]">
                              {r.company_industry && (
                                <span className="inline-flex items-center gap-1">
                                  <Building2 className="w-3 h-3" /> {r.company_industry}
                                </span>
                              )}
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
                            </div>
                          )}
                          {/* LinkedIn link */}
                          {r.linkedin_url && (
                            <a
                              href={r.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-[#0ABF53] hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" /> LinkedIn Profile
                            </a>
                          )}
                          {/* Sales-only: match reasons + approach */}
                          {salesIntent && r.match_score != null && (
                            <div className="pt-1 border-t border-[#E3E8EF] mt-2">
                              <span
                                className={`${getScoreColor(r.match_score)} text-white text-xs font-bold px-2 py-0.5 rounded-md inline-block mb-1`}
                              >
                                {r.match_score}/10
                              </span>
                            </div>
                          )}
                          {salesIntent && r.match_reasons && (() => {
                            const reasons = parseMatchReasons(r.match_reasons);
                            if (!reasons) return null;
                            return (
                              <div>
                                <span className="font-semibold text-[#0A2540] text-xs">
                                  Match reasons:{" "}
                                </span>
                                {reasons}
                              </div>
                            );
                          })()}
                          {salesIntent && r.suggested_approach && (
                            <div>
                              <span className="font-semibold text-[#0A2540] text-xs">
                                Approach:{" "}
                              </span>
                              {r.suggested_approach}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
