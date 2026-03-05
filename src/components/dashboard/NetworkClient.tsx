"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Users, ChevronDown, ChevronUp, MapPin, Star } from "lucide-react";

interface Connection {
  id: string;
  first_name: string;
  last_name: string;
  company: string;
  position: string;
  connected_on: string;
  seniority_tier: string | null;
  function_category: string | null;
  decision_maker_likelihood: string | null;
  connection_type_signal: string | null;
  enrichment_status: string;
  classification_status: string;
  match_score: number | null;
  linkedin_url: string | null;
  // Joined from enriched_profiles
  enriched_profile?: {
    city: string | null;
    country: string | null;
    total_experience_years: number | null;
    connections_count: number | null;
  } | null;
}

type SortField = "name" | "company" | "connected_on" | "seniority_tier" | "match_score";

export default function NetworkClient({ userId }: { userId: string }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("connected_on");
  const [sortAsc, setSortAsc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileMap, setProfileMap] = useState<Map<string, Connection["enriched_profile"]>>(new Map());
  const supabase = createClient();
  const pageSize = 50;

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("user_connections")
      .select("*", { count: "exact" })
      .eq("user_id", userId);

    if (search.trim()) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,company.ilike.%${search}%,position.ilike.%${search}%`
      );
    }

    const sortColumn =
      sortField === "name" ? "first_name" : sortField;
    query = query
      .order(sortColumn, { ascending: sortAsc, nullsFirst: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    const { data, count } = await query;
    const conns = (data as Connection[]) || [];
    setConnections(conns);
    setTotal(count || 0);

    // Fetch enriched profile data for these connections
    const linkedinUrls = conns
      .map((c) => c.linkedin_url)
      .filter((url): url is string => !!url);

    if (linkedinUrls.length > 0) {
      const { data: profiles } = await supabase
        .from("enriched_profiles")
        .select("linkedin_url, city, country, total_experience_years, connections_count")
        .in("linkedin_url", linkedinUrls);

      const map = new Map<string, Connection["enriched_profile"]>();
      for (const p of profiles || []) {
        map.set(p.linkedin_url, {
          city: p.city,
          country: p.country,
          total_experience_years: p.total_experience_years,
          connections_count: p.connections_count,
        });
      }
      setProfileMap(map);
    } else {
      setProfileMap(new Map());
    }

    setLoading(false);
  }, [supabase, userId, search, sortField, sortAsc, page]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  useEffect(() => {
    setPage(0);
  }, [search]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === "name");
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  function getSeniorityColor(tier: string | null) {
    switch (tier) {
      case "C-suite":
        return "bg-[#F3E8FF] text-[#7C3AED] border border-[#7C3AED]/20";
      case "VP/Director":
        return "bg-[#EFF6FF] text-[#2563EB] border border-[#2563EB]/20";
      case "Manager":
        return "bg-[#FFF8E6] text-[#B8860B] border border-[#FFBB38]/20";
      case "IC":
        return "bg-[#F0F3F7] text-[#596780] border border-[#E3E8EF]";
      default:
        return "bg-[#F0F3F7] text-[#96A0B5] border border-[#E3E8EF]";
    }
  }

  function getScoreColor(score: number) {
    if (score >= 9) return "bg-gradient-to-r from-[#0ABF53] to-[#34D399] text-white";
    if (score >= 7) return "bg-[#0ABF53] text-white";
    if (score >= 5) return "bg-[#FFBB38] text-white";
    return "bg-[#96A0B5] text-white";
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-[#96A0B5]" />;
    }
    return sortAsc ? (
      <ChevronUp className="w-3.5 h-3.5 text-[#0ABF53]" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-[#0ABF53]" />
    );
  }

  function getProfile(conn: Connection) {
    return conn.linkedin_url ? profileMap.get(conn.linkedin_url) : null;
  }

  function formatLocation(profile: Connection["enriched_profile"]) {
    if (!profile) return null;
    const parts = [profile.city, profile.country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-[#0A2540]">My Network</h1>
          <p className="text-sm text-[#96A0B5] mt-1 font-medium">
            {total.toLocaleString()} connections
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#96A0B5]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, or position..."
          className="w-full h-[52px] pl-12 pr-4 rounded-lg bg-white border border-[#E3E8EF] text-sm font-medium text-[#0A2540] placeholder:text-[#96A0B5] focus:border-[#0ABF53] focus:ring-2 focus:ring-[#0ABF53]/20 focus:outline-none transition-all"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] overflow-hidden animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F6F8FA] border-b border-[#E3E8EF]">
                <th className="text-left px-5 py-1">
                  <button
                    onClick={() => handleSort("name")}
                    className="flex items-center gap-1.5 min-h-[44px] text-xs font-medium uppercase tracking-wide text-[#596780] hover:text-[#0A2540] transition-colors"
                  >
                    Name
                    <SortIcon field="name" />
                  </button>
                </th>
                <th className="text-left px-5 py-1 hidden sm:table-cell">
                  <button
                    onClick={() => handleSort("company")}
                    className="flex items-center gap-1.5 min-h-[44px] text-xs font-medium uppercase tracking-wide text-[#596780] hover:text-[#0A2540] transition-colors"
                  >
                    Company
                    <SortIcon field="company" />
                  </button>
                </th>
                <th className="text-left px-5 py-1 hidden md:table-cell">
                  <span className="text-xs font-medium uppercase tracking-wide text-[#596780]">
                    Position
                  </span>
                </th>
                <th className="text-left px-5 py-1 hidden lg:table-cell">
                  <button
                    onClick={() => handleSort("seniority_tier")}
                    className="flex items-center gap-1.5 min-h-[44px] text-xs font-medium uppercase tracking-wide text-[#596780] hover:text-[#0A2540] transition-colors"
                  >
                    Seniority
                    <SortIcon field="seniority_tier" />
                  </button>
                </th>
                <th className="text-left px-5 py-1 hidden xl:table-cell">
                  <span className="text-xs font-medium uppercase tracking-wide text-[#596780]">
                    Location
                  </span>
                </th>
                <th className="text-left px-5 py-1 hidden xl:table-cell">
                  <span className="text-xs font-medium uppercase tracking-wide text-[#596780]">
                    Experience
                  </span>
                </th>
                <th className="text-left px-5 py-1">
                  <button
                    onClick={() => handleSort("match_score")}
                    className="flex items-center gap-1.5 min-h-[44px] text-xs font-medium uppercase tracking-wide text-[#596780] hover:text-[#0A2540] transition-colors"
                  >
                    Score
                    <SortIcon field="match_score" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="bg-white border-b border-[#F0F3F7] last:border-0">
                    <td className="px-5 py-4">
                      <div className="h-4 rounded-lg w-32 animate-shimmer" />
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <div className="h-4 rounded-lg w-24 animate-shimmer" />
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <div className="h-4 rounded-lg w-28 animate-shimmer" />
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <div className="h-5 rounded-full w-16 animate-shimmer" />
                    </td>
                    <td className="px-5 py-4 hidden xl:table-cell">
                      <div className="h-4 rounded-lg w-20 animate-shimmer" />
                    </td>
                    <td className="px-5 py-4 hidden xl:table-cell">
                      <div className="h-4 rounded-lg w-12 animate-shimmer" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-5 rounded-full w-10 animate-shimmer" />
                    </td>
                  </tr>
                ))
              ) : connections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-[#F0F3F7] flex items-center justify-center">
                        <Users className="w-7 h-7 text-[#96A0B5]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#0A2540]">
                          {search ? "No matches found" : "No connections yet"}
                        </p>
                        <p className="text-xs text-[#96A0B5] mt-1 max-w-[240px] mx-auto">
                          {search
                            ? "Try adjusting your search terms to find what you are looking for"
                            : "Upload your LinkedIn connections to get started"}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                connections.map((conn) => {
                  const profile = getProfile(conn);
                  const location = formatLocation(profile);
                  return (
                    <tr
                      key={conn.id}
                      className="bg-white border-b border-[#F0F3F7] last:border-0 hover:bg-[#F6F8FA] transition-colors duration-150"
                    >
                      <td className="px-5 py-3.5 font-semibold text-[#0A2540]">
                        {conn.first_name} {conn.last_name}
                      </td>
                      <td className="px-5 py-3.5 text-[#596780] hidden sm:table-cell">
                        {conn.company || "\u2014"}
                      </td>
                      <td className="px-5 py-3.5 text-[#596780] hidden md:table-cell truncate max-w-[200px]">
                        {conn.position || "\u2014"}
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        {conn.seniority_tier ? (
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${getSeniorityColor(conn.seniority_tier)}`}
                          >
                            {conn.seniority_tier}
                          </span>
                        ) : (
                          <span className="text-[#96A0B5]">{"\u2014"}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 hidden xl:table-cell">
                        {location ? (
                          <span className="inline-flex items-center gap-1 text-xs text-[#596780]">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[120px]">{location}</span>
                          </span>
                        ) : (
                          <span className="text-[#96A0B5]">{"\u2014"}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 hidden xl:table-cell">
                        {profile?.total_experience_years ? (
                          <span className="text-xs text-[#596780]">
                            {profile.total_experience_years}y
                          </span>
                        ) : (
                          <span className="text-[#96A0B5]">{"\u2014"}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {conn.match_score != null ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${getScoreColor(conn.match_score)}`}
                          >
                            <Star className="w-3 h-3" />
                            {conn.match_score}
                          </span>
                        ) : (
                          <span className="text-[#96A0B5]">{"\u2014"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#F0F3F7] bg-[#F6F8FA]/40">
            <p className="text-xs font-medium text-[#96A0B5]">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="h-[44px] w-[44px] flex items-center justify-center rounded-full bg-white border border-[#E3E8EF] hover:bg-[#F6F8FA] disabled:opacity-30 disabled:hover:bg-white transition-all duration-150 active:scale-[0.96]"
              >
                <ChevronLeft className="w-4 h-4 text-[#596780]" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="h-[44px] w-[44px] flex items-center justify-center rounded-full bg-white border border-[#E3E8EF] hover:bg-[#F6F8FA] disabled:opacity-30 disabled:hover:bg-white transition-all duration-150 active:scale-[0.96]"
              >
                <ChevronRight className="w-4 h-4 text-[#596780]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
