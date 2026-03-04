"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";

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
}

type SortField = "name" | "company" | "connected_on" | "seniority_tier";

export default function NetworkClient({ userId }: { userId: string }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("connected_on");
  const [sortAsc, setSortAsc] = useState(false);
  const [loading, setLoading] = useState(true);
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
      .order(sortColumn, { ascending: sortAsc })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    const { data, count } = await query;
    setConnections((data as Connection[]) || []);
    setTotal(count || 0);
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
      setSortAsc(true);
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  function getSeniorityColor(tier: string | null) {
    switch (tier) {
      case "C-suite":
        return "bg-amber-50 text-amber-800";
      case "VP/Director":
        return "bg-blue-50 text-blue-800";
      case "Manager":
        return "bg-green-50 text-green-800";
      case "IC":
        return "bg-gray-50 text-gray-700";
      default:
        return "bg-gray-50 text-gray-500";
    }
  }

  function getSignalColor(signal: string | null) {
    switch (signal) {
      case "Potential Customer":
        return "bg-blue-50 text-blue-800";
      case "Potential Investor":
        return "bg-purple-50 text-purple-800";
      case "Potential Advisor":
        return "bg-amber-50 text-amber-800";
      default:
        return "bg-gray-50 text-gray-600";
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Network</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total.toLocaleString()} connections
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, or position..."
          className="w-full h-12 pl-11 pr-4 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium">
                  <button
                    onClick={() => handleSort("name")}
                    className="flex items-center gap-1 min-h-[44px]"
                  >
                    Name
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">
                  <button
                    onClick={() => handleSort("company")}
                    className="flex items-center gap-1 min-h-[44px]"
                  >
                    Company
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">
                  Position
                </th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">
                  <button
                    onClick={() => handleSort("seniority_tier")}
                    className="flex items-center gap-1 min-h-[44px]"
                  >
                    Seniority
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">
                  Signal
                </th>
                <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">
                  <button
                    onClick={() => handleSort("connected_on")}
                    className="flex items-center gap-1 min-h-[44px]"
                  >
                    Connected
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse-slow w-32" />
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="h-4 bg-muted rounded animate-pulse-slow w-24" />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="h-4 bg-muted rounded animate-pulse-slow w-28" />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="h-4 bg-muted rounded animate-pulse-slow w-16" />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="h-4 bg-muted rounded animate-pulse-slow w-20" />
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <div className="h-4 bg-muted rounded animate-pulse-slow w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse-slow w-16" />
                    </td>
                  </tr>
                ))
              ) : connections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <p className="text-muted-foreground">
                      {search
                        ? "No connections match your search"
                        : "No connections yet"}
                    </p>
                  </td>
                </tr>
              ) : (
                connections.map((conn) => (
                  <tr
                    key={conn.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">
                      {conn.first_name} {conn.last_name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {conn.company || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell truncate max-w-[200px]">
                      {conn.position || "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {conn.seniority_tier ? (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getSeniorityColor(conn.seniority_tier)}`}
                        >
                          {conn.seniority_tier}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {conn.connection_type_signal ? (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getSignalColor(conn.connection_type_signal)}`}
                        >
                          {conn.connection_type_signal.replace("Potential ", "")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">
                      {conn.connected_on || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          conn.enrichment_status === "enriched" ||
                          conn.enrichment_status === "cached"
                            ? "bg-green-50 text-green-700"
                            : conn.enrichment_status === "skipped"
                              ? "bg-gray-50 text-gray-500"
                              : conn.classification_status === "classified"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-gray-50 text-gray-500"
                        }`}
                      >
                        {conn.enrichment_status === "enriched" ||
                        conn.enrichment_status === "cached"
                          ? "Enriched"
                          : conn.enrichment_status === "skipped"
                            ? "Skipped"
                            : conn.classification_status === "classified"
                              ? "Classified"
                              : "Pending"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="h-9 w-9 flex items-center justify-center rounded-lg border hover:bg-muted disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="h-9 w-9 flex items-center justify-center rounded-lg border hover:bg-muted disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
