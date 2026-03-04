"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  CheckCircle,
  Target,
  Flame,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ClipboardList,
  X,
  Loader2,
  Copy,
  Check,
  ListFilter,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Connection {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  company: string;
  linkedin_url: string;
  connected_on: string;
  seniority_tier: string;
  function_category: string;
  enrichment_tier: string;
  enrichment_status: string;
  enrichment_error: string | null;
  match_score: number | null;
  match_type: string | null;
  match_reasons: string[] | null;
  suggested_approach: string | null;
  scored_at: string | null;
  user_email: string;
  user_company: string;
  enriched_profile: {
    headline: string | null;
    current_title: string | null;
    current_company: string | null;
    location_str: string | null;
    total_experience_years: number | null;
    industry: string | null;
    follower_count: number | null;
    connections_count: number | null;
  } | null;
  enriched_company: {
    name: string | null;
    industry: string | null;
    description: string | null;
    company_size_min: number | null;
    company_size_max: number | null;
    hq_city: string | null;
    hq_country: string | null;
    latest_funding_type: string | null;
    total_funding_amount: number | null;
  } | null;
}

interface Stats {
  total_connections: number;
  classified: number;
  enriched: number;
  scored: number;
  hit_list: number;
  by_user: { email: string; company: string; count: number }[];
  by_status: { status: string; count: number }[];
  by_tier: { tier: string; count: number }[];
}

interface PipelineResponse {
  connections: Connection[];
  stats: Stats;
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface DetailData {
  connection: Record<string, unknown>;
  enriched_profile: Record<string, unknown> | null;
  enriched_company: Record<string, unknown> | null;
  prompt_runs: {
    id: string;
    prompt_type: string;
    model: string;
    user_prompt: string;
    response: string;
    input_tokens: number;
    output_tokens: number;
    duration_ms: number;
    created_at: string;
  }[];
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function SeniorityBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    "C-Suite": "bg-[#1B4332] text-white",
    "VP/Director": "bg-[#2D6A4F] text-white",
    Manager: "bg-amber-100 text-amber-800",
    IC: "bg-gray-100 text-gray-600",
    Other: "bg-gray-100 text-gray-500",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${styles[tier] || styles.Other}`}
    >
      {tier || "—"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    enriched: "bg-green-50 text-green-700 border-green-200",
    cached: "bg-blue-50 text-blue-700 border-blue-200",
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    skipped: "bg-gray-50 text-gray-500 border-gray-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${styles[status] || "bg-gray-50 text-gray-500 border-gray-200"}`}
    >
      {status || "—"}
    </span>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400">—</span>;
  let color = "bg-gray-100 text-gray-600";
  if (score >= 9) color = "bg-[#1B4332] text-white";
  else if (score >= 7) color = "bg-[#2D6A4F] text-white";
  else if (score >= 5) color = "bg-amber-100 text-amber-800";
  return (
    <span
      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${color}`}
    >
      {score}
    </span>
  );
}

const TableRow = React.memo(function TableRow({
  conn,
  onViewDetails,
}: {
  conn: Connection;
  onViewDetails: (conn: Connection) => void;
}) {
  const hitIcon =
    conn.match_score !== null
      ? conn.match_score >= 7
        ? "text-green-600"
        : "text-red-400"
      : "text-gray-300";

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
      <td className="px-3 py-2.5 text-[12px] text-gray-500 truncate max-w-[120px]" title={conn.user_email}>
        {conn.user_email.split("@")[0]}@...
      </td>
      <td className="px-3 py-2.5">
        {conn.linkedin_url ? (
          <a
            href={conn.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-medium text-foreground hover:text-accent transition-colors"
          >
            {conn.first_name} {conn.last_name}
          </a>
        ) : (
          <span className="text-[13px] font-medium">
            {conn.first_name} {conn.last_name}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-[12px] text-gray-600 max-w-[140px] truncate" title={conn.company}>
        {conn.company || "—"}
      </td>
      <td className="px-3 py-2.5 text-[12px] text-gray-500 max-w-[160px] truncate" title={conn.position}>
        {conn.position || "—"}
      </td>
      <td className="px-3 py-2.5">
        <SeniorityBadge tier={conn.seniority_tier} />
      </td>
      <td className="px-3 py-2.5 text-[11px] text-gray-500">{conn.enrichment_tier || "—"}</td>
      <td className="px-3 py-2.5">
        <StatusBadge status={conn.enrichment_status} />
      </td>
      <td className="px-3 py-2.5">
        <ScoreBadge score={conn.match_score} />
      </td>
      <td className="px-3 py-2.5 text-center">
        {conn.match_score !== null ? (
          conn.match_score >= 7 ? (
            <CheckCircle className={`w-4 h-4 ${hitIcon} inline`} />
          ) : (
            <XCircle className={`w-4 h-4 ${hitIcon} inline`} />
          )
        ) : (
          <span className="text-gray-300 text-xs">...</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onViewDetails(conn)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-foreground transition-colors"
            title="View Details"
          >
            <ClipboardList className="w-3.5 h-3.5" />
          </button>
          {conn.linkedin_url && (
            <a
              href={conn.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-accent transition-colors"
              title="Open LinkedIn"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </td>
    </tr>
  );
});

// ---------------------------------------------------------------------------
// Detail Panel
// ---------------------------------------------------------------------------

function DetailPanel({
  conn,
  onClose,
}: {
  conn: Connection;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"profile" | "json" | "prompts">("profile");
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadDetail = useCallback(async () => {
    if (detail) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/connection-detail?id=${conn.id}`);
      if (res.ok) setDetail(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [conn.id, detail]);

  useEffect(() => {
    if (tab === "json" || tab === "prompts") loadDetail();
  }, [tab, loadDetail]);

  const jsonText = useMemo(() => {
    if (!detail) return "";
    return JSON.stringify(
      {
        connection: detail.connection,
        enriched_profile: detail.enriched_profile,
        enriched_company: detail.enriched_company,
      },
      null,
      2
    );
  }, [detail]);

  function handleCopy() {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/20" onClick={onClose} />
      {/* Panel */}
      <div className="w-full max-w-[520px] bg-white shadow-2xl border-l border-gray-200 overflow-y-auto animate-slide-in-right">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-base font-semibold text-foreground">
            {conn.first_name} {conn.last_name}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-5">
          {(["profile", "json", "prompts"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                tab === t
                  ? "border-[#1B4332] text-[#1B4332]"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {t === "profile" ? "Profile" : t === "json" ? "Raw JSON" : "Prompt Log"}
            </button>
          ))}
        </div>

        <div className="px-5 py-5">
          {tab === "profile" && <ProfileTab conn={conn} />}
          {tab === "json" && (
            <div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : (
                <>
                  <button
                    onClick={handleCopy}
                    className="mb-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-[12px] font-medium text-gray-600 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy JSON"}
                  </button>
                  <pre className="text-[11px] leading-relaxed bg-gray-50 rounded-xl p-4 overflow-auto max-h-[600px] border border-gray-100 font-mono whitespace-pre-wrap break-words">
                    {jsonText}
                  </pre>
                </>
              )}
            </div>
          )}
          {tab === "prompts" && (
            <PromptsTab detail={detail} loading={loading} />
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ conn }: { conn: Connection }) {
  const profile = conn.enriched_profile;
  const company = conn.enriched_company;
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          {conn.first_name} {conn.last_name}
        </h3>
        <p className="text-sm text-gray-500 mt-0.5">
          {profile?.current_title || conn.position}{" "}
          {profile?.current_company ? `at ${profile.current_company}` : conn.company ? `at ${conn.company}` : ""}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {profile?.location_str || ""}
          {profile?.total_experience_years ? ` · ${profile.total_experience_years} years experience` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InfoCard label="Seniority" value={conn.seniority_tier || "—"} />
        <InfoCard label="Function" value={conn.function_category || "—"} />
        <InfoCard label="Enrichment" value={conn.enrichment_status || "—"} />
        <InfoCard label="Tier" value={conn.enrichment_tier || "—"} />
      </div>

      {conn.match_score !== null && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <ScoreBadge score={conn.match_score} />
            <span className="text-sm font-medium text-foreground">
              {conn.match_type || ""}
            </span>
            {conn.match_score >= 7 && (
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                Hit List
              </span>
            )}
          </div>
          {conn.match_reasons && conn.match_reasons.length > 0 && (
            <div className="space-y-1.5 mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reasons</p>
              {conn.match_reasons.map((r, i) => (
                <p key={i} className="text-[13px] text-gray-600 leading-relaxed">
                  &bull; {r}
                </p>
              ))}
            </div>
          )}
          {conn.suggested_approach && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Suggested Approach
              </p>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                {conn.suggested_approach}
              </p>
            </div>
          )}
        </div>
      )}

      {company && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Company
          </p>
          <p className="text-sm font-medium text-foreground">{company.name}</p>
          <p className="text-xs text-gray-500 mt-1">{company.industry || "No industry"}</p>
          {company.description && (
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              {company.description}
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
            {company.company_size_min && company.company_size_max && (
              <span>{company.company_size_min}-{company.company_size_max} employees</span>
            )}
            {(company.hq_city || company.hq_country) && (
              <span>{[company.hq_city, company.hq_country].filter(Boolean).join(", ")}</span>
            )}
            {company.latest_funding_type && <span>{company.latest_funding_type}</span>}
          </div>
        </div>
      )}

      {profile?.headline && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Headline</p>
          <p className="text-[13px] text-gray-600">{profile.headline}</p>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-[13px] font-medium text-foreground mt-0.5">{value}</p>
    </div>
  );
}

function PromptsTab({
  detail,
  loading,
}: {
  detail: DetailData | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!detail || detail.prompt_runs.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-8 text-center">
        No prompt logs found for this connection.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {detail.prompt_runs.map((run) => (
        <div key={run.id} className="border border-gray-100 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-600">
              {run.prompt_type} &middot; {run.model}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {new Date(run.created_at).toLocaleString()} &middot;{" "}
              {run.input_tokens} in / {run.output_tokens} out / {run.duration_ms}ms
            </p>
          </div>
          <details className="group">
            <summary className="px-4 py-2 text-[12px] font-medium text-gray-500 cursor-pointer hover:bg-gray-50">
              Input Prompt
            </summary>
            <pre className="px-4 py-3 text-[11px] font-mono bg-white max-h-[400px] overflow-auto whitespace-pre-wrap break-words text-gray-600 border-t border-gray-50">
              {run.user_prompt}
            </pre>
          </details>
          <details className="group">
            <summary className="px-4 py-2 text-[12px] font-medium text-gray-500 cursor-pointer hover:bg-gray-50 border-t border-gray-100">
              Output Response
            </summary>
            <pre className="px-4 py-3 text-[11px] font-mono bg-white max-h-[400px] overflow-auto whitespace-pre-wrap break-words text-gray-600 border-t border-gray-50">
              {run.response}
            </pre>
          </details>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function AdminDashboard() {
  const [data, setData] = useState<PipelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [seniorityFilter, setSeniorityFilter] = useState("");
  const [scoredOnly, setScoredOnly] = useState(false);
  const [hitListOnly, setHitListOnly] = useState(false);
  const [selectedConn, setSelectedConn] = useState<Connection | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, userFilter, statusFilter, seniorityFilter, scoredOnly, hitListOnly]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (userFilter) params.set("user_email", userFilter);
    if (statusFilter) params.set("enrichment_status", statusFilter);
    if (seniorityFilter) params.set("seniority_tier", seniorityFilter);
    if (scoredOnly) params.set("scored_only", "true");
    if (hitListOnly) params.set("hit_list_only", "true");

    try {
      const res = await fetch(`/api/admin/pipeline-data?${params}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, userFilter, statusFilter, seniorityFilter, scoredOnly, hitListOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = data?.stats;
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Admin Pipeline Monitor</h1>
        <p className="text-sm text-gray-400 mt-1">Full pipeline visibility across all users</p>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex flex-wrap gap-4 mb-4">
            <StatPill icon={<Users className="w-4 h-4" />} label="Users" value={stats.by_user.length} />
            <StatPill icon={<ListFilter className="w-4 h-4" />} label="Connections" value={stats.total_connections} />
            <StatPill icon={<CheckCircle className="w-4 h-4" />} label="Enriched" value={stats.enriched} />
            <StatPill icon={<Target className="w-4 h-4" />} label="Scored" value={stats.scored} />
            <StatPill icon={<Flame className="w-4 h-4" />} label="Hit List" value={stats.hit_list} />
            <StatPill
              icon={<XCircle className="w-4 h-4" />}
              label="Failed"
              value={stats.by_status.find((s) => s.status === "failed")?.count || 0}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.by_user.map((u) => (
              <button
                key={u.email}
                onClick={() => setUserFilter(userFilter === u.email ? "" : u.email)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                  userFilter === u.email
                    ? "bg-[#1B4332] text-white border-[#1B4332]"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                {u.email} ({u.count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search name, company, position..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] h-9 px-3 rounded-lg border border-gray-200 text-[13px] placeholder:text-gray-300 focus:outline-none focus:border-[#1B4332] focus:ring-1 focus:ring-[#1B4332]/20"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-gray-200 text-[13px] text-gray-600 focus:outline-none focus:border-[#1B4332]"
          >
            <option value="">All Statuses</option>
            <option value="enriched">Enriched</option>
            <option value="cached">Cached</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
          <select
            value={seniorityFilter}
            onChange={(e) => setSeniorityFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-gray-200 text-[13px] text-gray-600 focus:outline-none focus:border-[#1B4332]"
          >
            <option value="">All Seniorities</option>
            <option value="C-Suite">C-Suite</option>
            <option value="VP/Director">VP/Director</option>
            <option value="Manager">Manager</option>
            <option value="IC">IC</option>
            <option value="Other">Other</option>
          </select>
          <label className="flex items-center gap-1.5 text-[12px] text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={scoredOnly}
              onChange={(e) => setScoredOnly(e.target.checked)}
              className="rounded border-gray-300 text-[#1B4332] focus:ring-[#1B4332]"
            />
            Scored only
          </label>
          <label className="flex items-center gap-1.5 text-[12px] text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={hitListOnly}
              onChange={(e) => setHitListOnly(e.target.checked)}
              className="rounded border-gray-300 text-[#1B4332] focus:ring-[#1B4332]"
            />
            Hit List only
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Company</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Position</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Seniority</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Tier</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Score</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-center">Hit?</th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.connections || []).map((conn) => (
                  <TableRow
                    key={conn.id}
                    conn={conn}
                    onViewDetails={setSelectedConn}
                  />
                ))}
                {data?.connections.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-12 text-center text-sm text-gray-400">
                      No connections found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-[12px] text-gray-400">
              {pagination.total} results &middot; Page {pagination.page} of {pagination.total_pages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                disabled={page >= pagination.total_pages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedConn && (
        <DetailPanel conn={selectedConn} onClose={() => setSelectedConn(null)} />
      )}
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3.5 py-2 border border-gray-100">
      <span className="text-gray-400">{icon}</span>
      <span className="text-[13px] font-semibold text-foreground">{value}</span>
      <span className="text-[12px] text-gray-400">{label}</span>
    </div>
  );
}
