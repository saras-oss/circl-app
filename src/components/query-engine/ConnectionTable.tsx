"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

function getScoreColor(score: number | null) {
  if (!score) return "bg-[#96A0B5]";
  if (score >= 9) return "bg-gradient-to-r from-[#0ABF53] to-[#34D399]";
  if (score >= 7) return "bg-[#0ABF53]";
  if (score >= 5) return "bg-[#FFBB38]";
  return "bg-[#96A0B5]";
}

type SortField = "name" | "title" | "company" | "industry" | "score";
type SortDir = "asc" | "desc";

interface ConnectionTableProps {
  results: any[];
}

export default function ConnectionTable({ results }: ConnectionTableProps) {
  const [sortField, setSortField] = useState<SortField>("score");
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] overflow-hidden">
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
                onClick={() => handleSort("score")}
              >
                Score <SortIcon field="score" />
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r: any, i: number) => {
              const id = r.connection_id || String(i);
              const isExpanded = expandedId === id;
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
                        {r.match_score != null && (
                          <span
                            className={`${getScoreColor(r.match_score)} text-white text-xs font-bold px-2 py-0.5 rounded-md w-fit`}
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
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-4 bg-[#F6F8FA] border-t border-[#E3E8EF]">
                        <div className="pt-3 space-y-2 text-sm text-[#596780]">
                          {r.match_reasons && (
                            <div>
                              <span className="font-semibold text-[#0A2540] text-xs">
                                Match reasons:{" "}
                              </span>
                              {Array.isArray(r.match_reasons)
                                ? r.match_reasons.join(" · ")
                                : r.match_reasons}
                            </div>
                          )}
                          {r.suggested_approach && (
                            <div>
                              <span className="font-semibold text-[#0A2540] text-xs">
                                Approach:{" "}
                              </span>
                              {r.suggested_approach}
                            </div>
                          )}
                          {r.location_str && (
                            <div>
                              <span className="font-semibold text-[#0A2540] text-xs">
                                Location:{" "}
                              </span>
                              {r.location_str}
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
