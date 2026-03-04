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
        return "bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800 border border-amber-200/60";
      case "VP/Director":
        return "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 border border-blue-200/60";
      case "Manager":
        return "bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-800 border border-emerald-200/60";
      case "IC":
        return "bg-warm-100 text-warm-600 border border-warm-200/60";
      default:
        return "bg-warm-50 text-warm-400 border border-warm-200/40";
    }
  }

  function getScoreColor(score: number) {
    if (score >= 85) return "bg-[#1B4332] text-white";
    if (score >= 70) return "bg-[#2D6A4F] text-white";
    if (score >= 50) return "bg-amber-100 text-amber-800 border border-amber-200/60";
    return "bg-warm-100 text-warm-500 border border-warm-200/60";
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-warm-300" />;
    }
    return sortAsc ? (
      <ChevronUp className="w-3.5 h-3.5 text-accent" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-accent" />
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">My Network</h1>
          <p className="text-sm text-warm-400 mt-1 font-medium">
            {total.toLocaleString()} connections
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-warm-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, or position..."
          className="w-full h-[52px] pl-12 pr-4 rounded-2xl border-2 border-border bg-surface text-sm font-medium text-foreground placeholder:text-warm-400 input-ring transition-all"
        />
      </div>

      {/* Table */}
      <div className="card-elevated overflow-hidden animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-warm-50/60">
                <th className="text-left px-5 py-1">
                  <button
                    onClick={() => handleSort("name")}
                    className="flex items-center gap-1.5 min-h-[44px] text-xs font-semibold uppercase tracking-wider text-warm-400 hover:text-foreground transition-colors"
                  >
                    Name
                    <SortIcon field="name" />
                  </button>
                </th>
                <th className="text-left px-5 py-1 hidden sm:table-cell">
                  <button
                    onClick={() => handleSort("company")}
                    className="flex items-center gap-1.5 min-h-[44px] text-xs font-semibold uppercase tracking-wider text-warm-400 hover:text-foreground transition-colors"
                  >
                    Company
                    <SortIcon field="company" />
                  </button>
                </th>
                <th className="text-left px-5 py-1 hidden md:table-cell">
                  <span className="text-xs font-semibold uppercase tracking-wider text-warm-400">
                    Position
                  </span>
                </th>
                <th className="text-left px-5 py-1 hidden lg:table-cell">
                  <button
                    onClick={() => handleSort("seniority_tier")}
                    className="flex items-center gap-1.5 min-h-[44px] text-xs font-semibold uppercase tracking-wider text-warm-400 hover:text-foreground transition-colors"
                  >
                    Seniority
                    <SortIcon field="seniority_tier" />
                  </button>
                </th>
                <th className="text-left px-5 py-1 hidden xl:table-cell">
                  <span className="text-xs font-semibold uppercase tracking-wider text-warm-400">
                    Location
                  </span>
                </th>
                <th className="text-left px-5 py-1 hidden xl:table-cell">
                  <span className="text-xs font-semibold uppercase tracking-wider text-warm-400">
                    Experience
                  </span>
                </th>
                <th className="text-left px-5 py-1">
                  <button
                    onClick={() => handleSort("match_score")}
                    className="flex items-center gap-1.5 min-h-[44px] text-xs font-semibold uppercase tracking-wider text-warm-400 hover:text-foreground transition-colors"
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
                  <tr key={i} className="border-b border-border/50 last:border-0">
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
                      <div className="w-16 h-16 rounded-2xl bg-warm-100 flex items-center justify-center">
                        <Users className="w-7 h-7 text-warm-300" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {search ? "No matches found" : "No connections yet"}
                        </p>
                        <p className="text-xs text-warm-400 mt-1 max-w-[240px] mx-auto">
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
                      className="border-b border-border/40 last:border-0 hover:bg-warm-50 transition-colors duration-150"
                    >
                      <td className="px-5 py-3.5 font-semibold text-foreground">
                        {conn.first_name} {conn.last_name}
                      </td>
                      <td className="px-5 py-3.5 text-warm-500 hidden sm:table-cell">
                        {conn.company || "\u2014"}
                      </td>
                      <td className="px-5 py-3.5 text-warm-500 hidden md:table-cell truncate max-w-[200px]">
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
                          <span className="text-warm-300">{"\u2014"}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 hidden xl:table-cell">
                        {location ? (
                          <span className="inline-flex items-center gap-1 text-xs text-warm-500">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[120px]">{location}</span>
                          </span>
                        ) : (
                          <span className="text-warm-300">{"\u2014"}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 hidden xl:table-cell">
                        {profile?.total_experience_years ? (
                          <span className="text-xs text-warm-500">
                            {profile.total_experience_years}y
                          </span>
                        ) : (
                          <span className="text-warm-300">{"\u2014"}</span>
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
                          <span className="text-warm-300">{"\u2014"}</span>
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
          <div className="flex items-center justify-between px-5 py-4 border-t border-border/60 bg-warm-50/40">
            <p className="text-xs font-medium text-warm-400">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="h-[44px] w-[44px] flex items-center justify-center rounded-full border border-border bg-surface hover:bg-warm-50 hover:border-border-strong disabled:opacity-30 disabled:hover:bg-surface transition-all duration-150 active:scale-[0.96]"
              >
                <ChevronLeft className="w-4 h-4 text-warm-600" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="h-[44px] w-[44px] flex items-center justify-center rounded-full border border-border bg-surface hover:bg-warm-50 hover:border-border-strong disabled:opacity-30 disabled:hover:bg-surface transition-all duration-150 active:scale-[0.96]"
              >
                <ChevronRight className="w-4 h-4 text-warm-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
