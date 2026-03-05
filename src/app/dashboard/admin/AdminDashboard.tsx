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
  user_id: string;
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
  user_name: string;
  user_company: string;
}

interface Stats {
  total: number;
  enriched: number;
  scored: number;
  hits: number;
  misses: number;
  by_user: { email: string; name: string; company: string; count: number }[];
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

interface PromptRun {
  id: string;
  prompt_type: string;
  model: string;
  user_prompt: string;
  response: string;
  input_tokens: number;
  output_tokens: number;
  duration_ms: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Badge components
// ---------------------------------------------------------------------------

function SeniorityBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    "C-Suite": "bg-[#E6F9EE] text-[#089E45]",
    "VP/Director": "bg-[#E6F9EE] text-[#089E45]",
    Manager: "bg-[#FFF8E6] text-[#B8860B]",
    IC: "bg-[#F0F3F7] text-[#596780]",
    Other: "bg-[#F0F3F7] text-[#96A0B5]",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${styles[tier] || styles.Other}`}
    >
      {tier || "—"}
    </span>
  );
}

function TierPill({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    tier1: "bg-[#E6F9EE] text-[#089E45]",
    tier2: "bg-[#E8F0FE] text-[#3B6CE7]",
    tier3: "bg-[#F0F3F7] text-[#596780]",
    tier4: "bg-[#F0F3F7] text-[#96A0B5]",
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${styles[tier] || "bg-[#F0F3F7] text-[#96A0B5]"}`}
    >
      {tier || "—"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    enriched: "bg-[#E6F9EE] text-[#089E45] border-[#E6F9EE]",
    cached: "bg-[#E6F9EE] text-[#089E45] border-[#E6F9EE]",
    pending: "bg-[#FFF8E6] text-[#B8860B] border-[#FFF8E6]",
    failed: "bg-[#FDE8EC] text-[#ED5F74] border-[#FDE8EC]",
    skipped: "bg-[#F0F3F7] text-[#96A0B5] border-[#F0F3F7]",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${styles[status] || "bg-[#F0F3F7] text-[#96A0B5] border-[#F0F3F7]"}`}
    >
      {status || "—"}
    </span>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[#96A0B5] text-sm">—</span>;
  let color = "bg-[#96A0B5] text-white";
  if (score >= 9) color = "bg-gradient-to-br from-[#0ABF53] to-[#34D399] text-white";
  else if (score >= 7) color = "bg-[#0ABF53] text-white";
  else if (score >= 5) color = "bg-[#FFBB38] text-white";
  return (
    <span
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${color}`}
    >
      {score}
    </span>
  );
}

function VerdictBadge({ conn }: { conn: Connection }) {
  if (conn.enrichment_status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FDE8EC] text-[#ED5F74]">
        Failed
      </span>
    );
  }
  if (conn.match_score === null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F0F3F7] text-[#96A0B5]">
        Pending
      </span>
    );
  }
  if (conn.match_score >= 7) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#E6F9EE] text-[#089E45]">
        Hit
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FDE8EC] text-[#ED5F74]">
      Miss
    </span>
  );
}

// ---------------------------------------------------------------------------
// Modal component
// ---------------------------------------------------------------------------

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F3F7]">
          <h3 className="text-sm font-semibold text-[#0A2540]">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#F6F8FA] text-[#96A0B5] hover:text-[#0A2540] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0F3F7] hover:bg-[#E3E8EF] text-[12px] font-medium text-[#596780] transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// On-demand data loaders
// ---------------------------------------------------------------------------

function EnrichedDataModal({
  conn,
  onClose,
}: {
  conn: Connection;
  onClose: () => void;
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/connection-detail?connection_id=${conn.id}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conn.id]);

  const jsonText = useMemo(
    () => (data ? JSON.stringify(data, null, 2) : ""),
    [data]
  );

  return (
    <Modal
      title={`Enriched Data — ${conn.first_name} ${conn.last_name}`}
      onClose={onClose}
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-[#96A0B5]" />
        </div>
      ) : (
        <>
          <div className="mb-3">
            <CopyButton text={jsonText} />
          </div>
          <pre className="text-[11px] leading-relaxed bg-[#F6F8FA] rounded-xl p-4 overflow-auto max-h-[60vh] border border-[#E3E8EF] font-mono whitespace-pre-wrap break-words">
            {jsonText || "No enrichment data found."}
          </pre>
        </>
      )}
    </Modal>
  );
}

function PromptModal({
  conn,
  type,
  onClose,
}: {
  conn: Connection;
  type: "input" | "output";
  onClose: () => void;
}) {
  const [prompts, setPrompts] = useState<PromptRun[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({
      prompt_type: "matching",
    });
    if (conn.first_name) params.set("first_name", conn.first_name);
    if (conn.company) params.set("company", conn.company);

    fetch(`/api/admin/prompt-log?${params}`)
      .then((r) => r.json())
      .then((d) => setPrompts(d.prompts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conn.first_name, conn.company]);

  const text = useMemo(() => {
    if (!prompts || prompts.length === 0) return "";
    const run = prompts[0];
    return type === "input" ? run.user_prompt : run.response;
  }, [prompts, type]);

  const meta = prompts?.[0];

  return (
    <Modal
      title={`Scoring ${type === "input" ? "Input" : "Output"} — ${conn.first_name} ${conn.last_name}`}
      onClose={onClose}
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-[#96A0B5]" />
        </div>
      ) : !text ? (
        <p className="text-sm text-[#96A0B5] py-8 text-center">
          No prompt logs found for this connection.
        </p>
      ) : (
        <>
          {meta && (
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] text-[#96A0B5]">
                {meta.model} &middot; {meta.input_tokens} in / {meta.output_tokens} out / {meta.duration_ms}ms &middot;{" "}
                {new Date(meta.created_at).toLocaleString()}
              </p>
              <CopyButton text={text} />
            </div>
          )}
          <pre className="text-[11px] leading-relaxed bg-[#F6F8FA] rounded-xl p-4 overflow-auto max-h-[60vh] border border-[#E3E8EF] font-mono whitespace-pre-wrap break-words">
            {text}
          </pre>
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Table Row
// ---------------------------------------------------------------------------

const TableRow = React.memo(function TableRow({
  conn,
  onViewJson,
  onViewInput,
  onViewOutput,
}: {
  conn: Connection;
  onViewJson: (c: Connection) => void;
  onViewInput: (c: Connection) => void;
  onViewOutput: (c: Connection) => void;
}) {
  const isEnriched =
    conn.enrichment_status === "enriched" || conn.enrichment_status === "cached";
  const isScored = conn.match_score !== null;

  return (
    <tr className="border-b border-[#F0F3F7] hover:bg-[#F6F8FA] transition-colors">
      {/* User */}
      <td className="px-3 py-2.5">
        <div className="text-[12px] font-medium text-[#0A2540] truncate max-w-[120px]" title={conn.user_name}>
          {conn.user_name?.split(" ")[0] || conn.user_email.split("@")[0]}
        </div>
        <div className="text-[10px] text-[#96A0B5] truncate max-w-[120px]">{conn.user_company}</div>
      </td>
      {/* Connection */}
      <td className="px-3 py-2.5">
        <div className="text-[13px] font-semibold text-[#0A2540]">
          {conn.first_name} {conn.last_name}
        </div>
        {conn.linkedin_url && (
          <a
            href={conn.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[#0ABF53] hover:underline"
          >
            LinkedIn &#8599;
          </a>
        )}
      </td>
      {/* Title */}
      <td className="px-3 py-2.5 text-[12px] text-[#596780] max-w-[160px] truncate" title={conn.position}>
        {conn.position || "—"}
      </td>
      {/* Company */}
      <td className="px-3 py-2.5 text-[12px] text-[#596780] max-w-[140px] truncate" title={conn.company}>
        {conn.company || "—"}
      </td>
      {/* Seniority */}
      <td className="px-3 py-2.5">
        <SeniorityBadge tier={conn.seniority_tier} />
      </td>
      {/* Tier */}
      <td className="px-3 py-2.5">
        <TierPill tier={conn.enrichment_tier} />
      </td>
      {/* Enrichment Status */}
      <td className="px-3 py-2.5">
        <StatusBadge status={conn.enrichment_status} />
      </td>
      {/* Enriched Data */}
      <td className="px-3 py-2.5">
        {isEnriched ? (
          <button
            onClick={() => onViewJson(conn)}
            className="text-[11px] font-medium text-[#0ABF53] hover:underline whitespace-nowrap"
          >
            View JSON
          </button>
        ) : (
          <span className="text-[#96A0B5] text-[12px]">—</span>
        )}
      </td>
      {/* Scoring Input */}
      <td className="px-3 py-2.5">
        {isScored ? (
          <button
            onClick={() => onViewInput(conn)}
            className="text-[11px] font-medium text-[#0ABF53] hover:underline whitespace-nowrap"
          >
            Input
          </button>
        ) : (
          <span className="text-[#96A0B5] text-[11px]">...</span>
        )}
      </td>
      {/* Scoring Output */}
      <td className="px-3 py-2.5">
        {isScored ? (
          <button
            onClick={() => onViewOutput(conn)}
            className="text-[11px] font-medium text-[#0ABF53] hover:underline whitespace-nowrap"
          >
            Output
          </button>
        ) : (
          <span className="text-[#96A0B5] text-[11px]">...</span>
        )}
      </td>
      {/* Score */}
      <td className="px-3 py-2.5">
        <ScoreBadge score={conn.match_score} />
      </td>
      {/* Verdict */}
      <td className="px-3 py-2.5">
        <VerdictBadge conn={conn} />
      </td>
    </tr>
  );
});

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
  const [tierFilter, setTierFilter] = useState("");
  const [scoredOnly, setScoredOnly] = useState(false);
  const [hitListOnly, setHitListOnly] = useState(false);
  const [enrichedOnly, setEnrichedOnly] = useState(false);

  // Modal states
  const [jsonConn, setJsonConn] = useState<Connection | null>(null);
  const [inputConn, setInputConn] = useState<Connection | null>(null);
  const [outputConn, setOutputConn] = useState<Connection | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, userFilter, statusFilter, seniorityFilter, tierFilter, scoredOnly, hitListOnly, enrichedOnly]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (userFilter) params.set("user_email", userFilter);
    if (statusFilter) params.set("enrichment_status", statusFilter);
    if (seniorityFilter) params.set("seniority_tier", seniorityFilter);
    if (tierFilter) params.set("enrichment_tier", tierFilter);
    if (scoredOnly) params.set("scored_only", "true");
    if (hitListOnly) params.set("hit_list_only", "true");
    if (enrichedOnly) params.set("enriched_only", "true");

    try {
      const res = await fetch(`/api/admin/pipeline-data?${params}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, userFilter, statusFilter, seniorityFilter, tierFilter, scoredOnly, hitListOnly, enrichedOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = data?.stats;
  const pagination = data?.pagination;

  const columns = [
    "User",
    "Connection",
    "Title",
    "Company",
    "Seniority",
    "Tier",
    "Status",
    "Enriched",
    "Input",
    "Output",
    "Score",
    "Verdict",
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <h1 className="text-xl font-semibold text-[#0A2540]">Admin Pipeline Monitor</h1>

      {/* Stats Bar */}
      {stats && (
        <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-5">
          <div className="flex flex-wrap gap-3 mb-4">
            <StatPill icon={<Users className="w-4 h-4" />} label="Users" value={stats.by_user.length} />
            <StatPill icon={<ListFilter className="w-4 h-4" />} label="Connections" value={stats.total} />
            <StatPill icon={<CheckCircle className="w-4 h-4" />} label="Enriched" value={stats.enriched} />
            <StatPill icon={<Target className="w-4 h-4" />} label="Scored" value={stats.scored} />
            <StatPill icon={<Flame className="w-4 h-4" />} label="Hits" value={stats.hits} />
            <StatPill icon={<XCircle className="w-4 h-4" />} label="Misses" value={stats.misses} />
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.by_user.map((u) => (
              <button
                key={u.email}
                onClick={() => setUserFilter(userFilter === u.email ? "" : u.email)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                  userFilter === u.email
                    ? "bg-[#0ABF53] text-white border-[#0ABF53]"
                    : "bg-white text-[#596780] border-[#E3E8EF] hover:border-[#96A0B5]"
                }`}
              >
                {u.name?.split(" ")[0] || u.email.split("@")[0]} &middot; {u.company || "—"} ({u.count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search name, company, title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] h-9 px-3 rounded-lg border border-[#E3E8EF] text-[13px] text-[#0A2540] placeholder:text-[#96A0B5] focus:outline-none focus:border-[#0ABF53] focus:ring-1 focus:ring-[#0ABF53]/20"
          />
          <select
            value={seniorityFilter}
            onChange={(e) => setSeniorityFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[#E3E8EF] text-[13px] text-[#596780] focus:outline-none focus:border-[#0ABF53] focus:ring-1 focus:ring-[#0ABF53]/20"
          >
            <option value="">All Seniorities</option>
            <option value="C-Suite">C-Suite</option>
            <option value="VP/Director">VP/Director</option>
            <option value="Manager">Manager</option>
            <option value="IC">IC</option>
            <option value="Other">Other</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[#E3E8EF] text-[13px] text-[#596780] focus:outline-none focus:border-[#0ABF53] focus:ring-1 focus:ring-[#0ABF53]/20"
          >
            <option value="">All Statuses</option>
            <option value="enriched">Enriched</option>
            <option value="cached">Cached</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[#E3E8EF] text-[13px] text-[#596780] focus:outline-none focus:border-[#0ABF53] focus:ring-1 focus:ring-[#0ABF53]/20"
          >
            <option value="">All Tiers</option>
            <option value="tier1">Tier 1</option>
            <option value="tier2">Tier 2</option>
            <option value="tier3">Tier 3</option>
            <option value="tier4">Tier 4</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-4 mt-3">
          <TogglePill label="Scored only" checked={scoredOnly} onChange={setScoredOnly} />
          <TogglePill label="Hits only" checked={hitListOnly} onChange={setHitListOnly} />
          <TogglePill label="Enriched only" checked={enrichedOnly} onChange={setEnrichedOnly} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-[#96A0B5]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[#E3E8EF] bg-[#F6F8FA]">
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2.5 text-[11px] font-semibold text-[#596780] uppercase tracking-wider whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.connections || []).map((conn) => (
                  <TableRow
                    key={conn.id}
                    conn={conn}
                    onViewJson={setJsonConn}
                    onViewInput={setInputConn}
                    onViewOutput={setOutputConn}
                  />
                ))}
                {data?.connections.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-3 py-12 text-center text-sm text-[#96A0B5]">
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#F0F3F7]">
            <p className="text-[12px] text-[#96A0B5]">
              {pagination.total} results &middot; Page {pagination.page} of{" "}
              {pagination.total_pages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#596780] hover:bg-[#F6F8FA] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <button
                onClick={() =>
                  setPage((p) => Math.min(pagination.total_pages, p + 1))
                }
                disabled={page >= pagination.total_pages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#596780] hover:bg-[#F6F8FA] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {jsonConn && (
        <EnrichedDataModal conn={jsonConn} onClose={() => setJsonConn(null)} />
      )}
      {inputConn && (
        <PromptModal
          conn={inputConn}
          type="input"
          onClose={() => setInputConn(null)}
        />
      )}
      {outputConn && (
        <PromptModal
          conn={outputConn}
          type="output"
          onClose={() => setOutputConn(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small UI components
// ---------------------------------------------------------------------------

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
    <div className="flex items-center gap-2 bg-white rounded-xl px-3.5 py-2 border border-[#E3E8EF] shadow-sm">
      <span className="text-[#0ABF53]">{icon}</span>
      <span className="text-[13px] font-semibold text-[#0A2540]">{value}</span>
      <span className="text-[12px] text-[#596780]">{label}</span>
    </div>
  );
}

function TogglePill({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[12px] text-[#596780] cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-[#E3E8EF] text-[#0ABF53] focus:ring-[#0ABF53] w-3.5 h-3.5"
      />
      {label}
    </label>
  );
}
