"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Pause,
  Play,
  Square,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  FileText,
  Activity,
  LayoutDashboard,
  MessageSquare,
  ChevronDown,
  Clock,
  Search,
  Trash2,
  AlertTriangle,
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
// Pipeline Jobs types & section
// ---------------------------------------------------------------------------

interface PipelineJob {
  id: string;
  user_id: string;
  status: string;
  mode: string;
  total_connections: number;
  recent_count: number;
  old_count: number;
  classified_count: number;
  enriched_persons_count: number;
  enriched_companies_count: number;
  scored_count: number;
  hits_count: number;
  skipped_count: number;
  failed_items_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  last_tick_at: string | null;
  estimated_completion: string | null;
  error_log: Array<{ step?: string; error?: string; timestamp?: string }> | null;
  admin_action: string | null;
  admin_note: string | null;
  cost_enrichlayer: number | null;
  cost_anthropic_tokens: number | null;
  consecutive_failures: number;
  users: { full_name: string; email: string; company_name: string } | null;
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return "just now";
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function MiniProgress({
  label,
  current,
  total,
}: {
  label: string;
  current: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const done = total > 0 && current >= total;
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className="text-[#596780] w-[80px] shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[#E3E8EF] overflow-hidden">
        <div
          className="h-full rounded-full bg-[#0ABF53] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[#596780] tabular-nums whitespace-nowrap w-[80px] text-right">
        {current.toLocaleString()}/{total.toLocaleString()}
        {done ? " ✅" : ""}
      </span>
    </div>
  );
}

const JOB_STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  queued: { bg: "bg-[#F0F3F7]", text: "text-[#596780]", label: "Queued" },
  classifying: { bg: "bg-[#EFF6FF]", text: "text-[#2563EB]", label: "Classifying" },
  enriching: { bg: "bg-[#EFF6FF]", text: "text-[#2563EB]", label: "Enriching" },
  enriching_persons: { bg: "bg-[#EFF6FF]", text: "text-[#2563EB]", label: "Enriching" },
  enriching_companies: { bg: "bg-[#EFF6FF]", text: "text-[#2563EB]", label: "Companies" },
  scoring: { bg: "bg-[#F3E8FF]", text: "text-[#7C3AED]", label: "Scoring" },
  completed: { bg: "bg-[#E6F9EE]", text: "text-[#089E45]", label: "Completed" },
  failed: { bg: "bg-[#FDE8EC]", text: "text-[#ED5F74]", label: "Failed" },
  paused: { bg: "bg-[#FFF8E6]", text: "text-[#B8860B]", label: "Paused" },
  cancelled: { bg: "bg-[#F0F3F7]", text: "text-[#96A0B5]", label: "Cancelled" },
};

function JobStatusBadge({ status }: { status: string }) {
  const s = JOB_STATUS_BADGES[status] || JOB_STATUS_BADGES.queued;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}
    >
      {s.label}
    </span>
  );
}

function JobCard({
  job,
  onAction,
  onViewErrors,
}: {
  job: PipelineJob;
  onAction: (jobId: string, action: string) => void;
  onViewErrors: (job: PipelineJob) => void;
}) {
  const userName = job.users?.full_name?.split(" ")[0] || job.users?.email?.split("@")[0] || "Unknown";
  const companyName = job.users?.company_name || "";
  const isActive = ["queued", "classifying", "enriching", "enriching_persons", "enriching_companies", "scoring"].includes(job.status);
  const isPaused = job.status === "paused";
  const isCompleted = job.status === "completed";
  const isCancelled = job.status === "cancelled";
  const hasFailed = (job.failed_items_count || 0) > 0;
  const hasErrors = job.error_log && job.error_log.length > 0;

  // Correct denominators: classify=all, enrich=classified-skipped (tier1/2), score=enriched
  const enrichEligible = Math.max((job.classified_count || 0) - (job.skipped_count || 0), job.enriched_persons_count || 0, 1);
  const scoreEligible = Math.max(job.enriched_persons_count || 0, 1);

  // Overall progress percentage (weighted: classify 1x, enrich 3x, score 2x)
  const classifyWeight = 1, enrichWeight = 3, scoreWeight = 2;
  const totalWeight = (job.total_connections || 1) * (classifyWeight + enrichWeight + scoreWeight);
  const doneWeight =
    (job.classified_count || 0) * classifyWeight +
    (job.enriched_persons_count || 0) * enrichWeight +
    (job.scored_count || 0) * scoreWeight;
  const overallPct = totalWeight > 0 ? Math.min(100, Math.round((doneWeight / totalWeight) * 100)) : 0;

  // Duration
  const startTime = job.started_at || job.created_at;
  const endTime = job.completed_at;
  let duration = "";
  if (startTime && endTime) {
    const ms = new Date(endTime).getTime() - new Date(startTime).getTime();
    const secs = Math.floor(ms / 1000);
    if (secs < 60) duration = `${secs}s`;
    else if (secs < 3600) duration = `${Math.floor(secs / 60)}m ${secs % 60}s`;
    else duration = `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  }

  // Compact view for completed/cancelled
  if (isCompleted || isCancelled) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[13px] font-semibold text-[#0A2540]">
              {userName}
            </span>
            {companyName && (
              <span className="text-[12px] text-[#96A0B5]">· {companyName}</span>
            )}
            <JobStatusBadge status={job.status} />
          </div>
          <div className="flex items-center gap-3 text-[12px] text-[#596780]">
            <span>{job.total_connections.toLocaleString()} connections{job.mode === "instant" ? " (instant)" : ""}</span>
            {isCompleted && (
              <>
                <span>· Hits: {job.hits_count || 0}</span>
                <span>· Scored: {job.scored_count || 0}</span>
                {duration && <span>· Took: {duration}</span>}
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <ActionButton label="Restart" icon={<RefreshCw className="w-3 h-3" />} onClick={() => onAction(job.id, "restart")} />
          {hasErrors && (
            <ActionButton label="Errors" icon={<FileText className="w-3 h-3" />} onClick={() => onViewErrors(job)} variant="muted" />
          )}
        </div>
      </div>
    );
  }

  // Full card for active/paused/failed jobs
  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-5 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[14px] font-semibold text-[#0A2540]">
            {userName}
          </span>
          {companyName && (
            <span className="text-[12px] text-[#96A0B5]">· {companyName}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <JobStatusBadge status={job.status} />
          {isActive && (
            <span className="text-[12px] font-medium text-[#0A2540]">{overallPct}%</span>
          )}
        </div>
      </div>

      {/* Connection count */}
      <p className="text-[12px] text-[#596780]">
        {job.total_connections.toLocaleString()} connections
        {job.mode === "instant" ? " (instant mode)" : ""}
      </p>

      {/* Progress bars */}
      <div className="space-y-2">
        <MiniProgress label="Classified:" current={job.classified_count || 0} total={job.total_connections || 0} />
        <MiniProgress label="Enriched:" current={job.enriched_persons_count || 0} total={enrichEligible} />
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-[#596780] w-[80px] shrink-0">Companies:</span>
          <span className="text-[#596780] tabular-nums">
            {(job.enriched_companies_count || 0).toLocaleString()} enriched
          </span>
        </div>
        <MiniProgress label="Scored:" current={job.scored_count || 0} total={scoreEligible} />
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#596780]">
        <span>Hits: <strong className="text-[#0A2540]">{job.hits_count || 0}</strong></span>
        {hasFailed && (
          <span>Failed: <strong className="text-[#ED5F74]">{job.failed_items_count}</strong></span>
        )}
        {(job.cost_enrichlayer || job.cost_anthropic_tokens) && (
          <span>
            Cost: ${((job.cost_enrichlayer || 0) + (job.cost_anthropic_tokens || 0)).toFixed(2)}
          </span>
        )}
      </div>

      {/* Timing */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#96A0B5]">
        <span>Last tick: {relativeTime(job.last_tick_at)}</span>
        <span>· Started: {relativeTime(job.started_at || job.created_at)}</span>
        {job.estimated_completion && (
          <span>· ETA: {relativeTime(job.estimated_completion)}</span>
        )}
      </div>

      {/* Admin note */}
      {job.admin_note && (
        <p className="text-[11px] text-[#96A0B5] italic">{job.admin_note}</p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        {isActive && (
          <ActionButton label="Pause" icon={<Pause className="w-3 h-3" />} onClick={() => onAction(job.id, "pause")} />
        )}
        {isPaused && (
          <ActionButton label="Resume" icon={<Play className="w-3 h-3" />} onClick={() => onAction(job.id, "resume")} variant="primary" />
        )}
        {(isActive || isPaused) && (
          <ActionButton label="Cancel" icon={<Square className="w-3 h-3" />} onClick={() => onAction(job.id, "cancel")} variant="danger" />
        )}
        <ActionButton label="Restart" icon={<RefreshCw className="w-3 h-3" />} onClick={() => onAction(job.id, "restart")} />
        {hasFailed && (
          <ActionButton label="Retry Failed" icon={<RotateCcw className="w-3 h-3" />} onClick={() => onAction(job.id, "retry_failed")} />
        )}
        {(isActive || isPaused) && (
          <ActionButton label="Force Complete" icon={<CheckCircle2 className="w-3 h-3" />} onClick={() => onAction(job.id, "force_complete")} variant="muted" />
        )}
        {hasErrors && (
          <ActionButton label="Errors" icon={<FileText className="w-3 h-3" />} onClick={() => onViewErrors(job)} variant="muted" />
        )}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  variant = "default",
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "primary" | "danger" | "muted";
}) {
  const styles = {
    default: "bg-white border-[#E3E8EF] text-[#596780] hover:border-[#96A0B5] hover:text-[#0A2540]",
    primary: "bg-[#0A2540] border-[#0A2540] text-white hover:bg-[#0A2540]/90",
    danger: "bg-white border-[#FDE8EC] text-[#ED5F74] hover:border-[#ED5F74] hover:bg-[#FDE8EC]",
    muted: "bg-[#F6F8FA] border-[#E3E8EF] text-[#96A0B5] hover:text-[#596780] hover:border-[#96A0B5]",
  };

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${styles[variant]}`}
    >
      {icon}
      {label}
    </button>
  );
}

function ErrorLogModal({
  job,
  onClose,
}: {
  job: PipelineJob;
  onClose: () => void;
}) {
  const errors = job.error_log || [];
  const jsonText = JSON.stringify(errors, null, 2);
  const userName = job.users?.full_name || job.users?.email || "Unknown";

  return (
    <Modal title={`Error Log — ${userName}`} onClose={onClose}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] text-[#96A0B5]">{errors.length} error(s)</p>
        <CopyButton text={jsonText} />
      </div>
      {errors.length === 0 ? (
        <p className="text-sm text-[#96A0B5] py-8 text-center">No errors logged.</p>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-auto">
          {errors.map((entry, i) => (
            <div
              key={i}
              className="bg-[#F6F8FA] rounded-lg p-3 border border-[#E3E8EF] text-[11px] font-mono"
            >
              {entry.step && (
                <span className="text-[#7C3AED] font-semibold">[{entry.step}] </span>
              )}
              <span className="text-[#ED5F74]">{entry.error || "Unknown error"}</span>
              {entry.timestamp && (
                <div className="text-[#96A0B5] mt-1 text-[10px]">
                  {new Date(entry.timestamp).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function PipelineJobsSection() {
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorJob, setErrorJob] = useState<PipelineJob | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pipeline-jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    intervalRef.current = setInterval(fetchJobs, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchJobs]);

  async function handleAction(jobId: string, action: string) {
    // Confirmation for destructive actions
    if (action === "cancel" && !window.confirm("Are you sure you want to cancel this pipeline job? This cannot be undone.")) return;
    if (action === "restart" && !window.confirm("Are you sure you want to restart this pipeline job? All progress will be reset.")) return;

    setActionLoading(jobId);
    try {
      const res = await fetch("/api/admin/pipeline-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, action }),
      });
      if (res.ok) {
        await fetchJobs();
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#635BFF]" />
          <h2 className="text-base font-semibold text-[#0A2540]">Pipeline Jobs</h2>
        </div>
        <div className="flex items-center gap-2">
          {actionLoading && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#96A0B5]" />
          )}
          <span className="text-[10px] text-[#96A0B5]">Auto-refreshes every 10s</span>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-[#96A0B5]" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] flex items-center justify-center py-12">
          <p className="text-sm text-[#96A0B5]">No pipeline jobs yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onAction={handleAction}
              onViewErrors={setErrorJob}
            />
          ))}
        </div>
      )}

      {errorJob && (
        <ErrorLogModal job={errorJob} onClose={() => setErrorJob(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge components
// ---------------------------------------------------------------------------

function SeniorityBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    "C-Suite": "bg-[#F3E8FF] text-[#7C3AED]",
    "VP/Director": "bg-[#EFF6FF] text-[#2563EB]",
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
// Pipeline Tab (formerly the main dashboard)
// ---------------------------------------------------------------------------

function PipelineTab() {
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
      {/* Pipeline Jobs */}
      <PipelineJobsSection />

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
                    ? "bg-[#0A2540] text-white border-[#0A2540]"
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

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

interface OverviewStats {
  total_users: number;
  total_connections: number;
  total_enriched: number;
  total_scored: number;
  total_hits: number;
}

interface ActivityEvent {
  type: "pipeline" | "query" | "user_joined";
  userName: string;
  description: string;
  time: string;
}

function OverviewTab() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOverview() {
      try {
        // Fetch pipeline data for stats
        const [pipeRes, activityRes, queriesRes] = await Promise.all([
          fetch("/api/admin/pipeline-data?page=1"),
          fetch("/api/admin/activity?days=7"),
          fetch("/api/admin/queries?days=7"),
        ]);

        const pipeData = pipeRes.ok ? await pipeRes.json() : null;
        const activityData = activityRes.ok ? await activityRes.json() : null;
        const queriesData = queriesRes.ok ? await queriesRes.json() : null;

        if (pipeData?.stats) {
          setStats({
            total_users: pipeData.stats.by_user?.length || 0,
            total_connections: pipeData.stats.total || 0,
            total_enriched: pipeData.stats.enriched || 0,
            total_scored: pipeData.stats.scored || 0,
            total_hits: pipeData.stats.hits || 0,
          });
        }

        // Build activity feed
        const feed: ActivityEvent[] = [];

        // Pipeline events from jobs
        const jobsRes = await fetch("/api/admin/pipeline-jobs");
        if (jobsRes.ok) {
          const jobsData = await jobsRes.json();
          for (const job of (jobsData.jobs || []).slice(0, 10)) {
            const userName = job.users?.full_name?.split(" ")[0] || job.users?.email?.split("@")[0] || "Unknown";
            if (job.status === "completed" && job.completed_at) {
              feed.push({
                type: "pipeline",
                userName,
                description: `Pipeline completed — ${job.hits_count || 0} hits from ${job.total_connections} connections`,
                time: job.completed_at,
              });
            }
            if (job.started_at) {
              feed.push({
                type: "pipeline",
                userName,
                description: `Pipeline started — ${job.total_connections} connections (${job.mode || "background"})`,
                time: job.started_at,
              });
            }
          }
        }

        // Query events
        if (queriesData?.queries) {
          for (const q of queriesData.queries.slice(0, 10)) {
            feed.push({
              type: "query",
              userName: q.full_name?.split(" ")[0] || "Unknown",
              description: `Asked: "${q.question?.slice(0, 60)}${q.question?.length > 60 ? "..." : ""}" — ${q.results_count} results`,
              time: q.created_at,
            });
          }
        }

        // User joins
        if (activityData?.users) {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          for (const u of activityData.users) {
            if (u.joined && new Date(u.joined) >= sevenDaysAgo) {
              feed.push({
                type: "user_joined",
                userName: u.full_name?.split(" ")[0] || u.email?.split("@")[0] || "Unknown",
                description: `Joined — ${u.company_name || ""}`,
                time: u.joined,
              });
            }
          }
        }

        // Sort by time desc
        feed.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        setEvents(feed.slice(0, 20));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-[#96A0B5]" />
      </div>
    );
  }

  const eventIcon = (type: string) => {
    if (type === "pipeline") return <Activity className="w-3.5 h-3.5 text-[#0ABF53]" />;
    if (type === "query") return <MessageSquare className="w-3.5 h-3.5 text-[#2563EB]" />;
    return <Users className="w-3.5 h-3.5 text-[#596780]" />;
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { icon: <Users className="w-4 h-4" />, label: "Users", value: stats.total_users },
            { icon: <ListFilter className="w-4 h-4" />, label: "Connections", value: stats.total_connections },
            { icon: <CheckCircle className="w-4 h-4" />, label: "Enriched", value: stats.total_enriched },
            { icon: <Target className="w-4 h-4" />, label: "Scored", value: stats.total_scored },
            { icon: <Flame className="w-4 h-4" />, label: "Hits", value: stats.total_hits },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm p-4 flex items-center gap-3">
              <span className="text-[#0ABF53]">{s.icon}</span>
              <div>
                <p className="text-lg font-semibold text-[#0A2540] tabular-nums">{s.value.toLocaleString()}</p>
                <p className="text-[11px] text-[#596780]">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Activity feed */}
      <div className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm">
        <div className="px-5 py-4 border-b border-[#F0F3F7]">
          <h3 className="text-sm font-semibold text-[#0A2540]">Recent Activity</h3>
        </div>
        <div className="divide-y divide-[#F0F3F7]">
          {events.length === 0 ? (
            <p className="text-sm text-[#96A0B5] py-12 text-center">No recent activity</p>
          ) : (
            events.map((event, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3">
                <div className="mt-0.5 shrink-0">{eventIcon(event.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#0A2540]">
                    <span className="font-medium">{event.userName}</span>{" "}
                    <span className="text-[#596780]">{event.description}</span>
                  </p>
                </div>
                <span className="text-[11px] text-[#96A0B5] shrink-0 tabular-nums">{relativeTime(event.time)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users Tab
// ---------------------------------------------------------------------------

interface ActivityUser {
  user_id: string;
  full_name: string;
  email: string;
  company_name: string;
  joined: string;
  last_seen: string | null;
  total_connections: number;
  enriched_count: number;
  hits_count: number;
  page_views: Record<string, number>;
  total_views: number;
  query_count: number;
  sessions: { started: string; pages: string[]; duration_minutes: number }[];
}

function DeleteUserModal({
  user,
  onClose,
  onDeleted,
}: {
  user: ActivityUser;
  onClose: () => void;
  onDeleted: (userId: string) => void;
}) {
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmEmail === user.email;

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.user_id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Delete failed");
        setDeleting(false);
        return;
      }

      onDeleted(user.user_id);
      onClose();
    } catch {
      setError("Network error — please try again");
      setDeleting(false);
    }
  }

  return (
    <Modal title="Delete User" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-[#FDE8EC] border border-[#FACDD6]">
          <AlertTriangle className="w-5 h-5 text-[#ED5F74] shrink-0 mt-0.5" />
          <div className="text-[13px] text-[#0A2540]">
            <p className="font-semibold">
              Delete {user.full_name || user.email}?
            </p>
            <p className="text-[#596780] mt-1">
              This removes their connections, pipeline jobs, and query history.
              Enrichment cache (enriched_profiles, enriched_companies) is
              preserved for other users.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-[#596780] mb-1.5">
            Type <strong>{user.email}</strong> to confirm
          </label>
          <input
            type="text"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder={user.email}
            className="w-full h-9 px-3 rounded-lg border border-[#E3E8EF] text-[13px] text-[#0A2540] placeholder:text-[#96A0B5] focus:outline-none focus:border-[#ED5F74] focus:ring-1 focus:ring-[#ED5F74]/20"
            autoFocus
          />
        </div>

        {error && (
          <p className="text-[12px] text-[#ED5F74]">{error}</p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-[#596780] hover:bg-[#F6F8FA] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!canDelete || deleting}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-white bg-[#ED5F74] hover:bg-[#E04860] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Delete User
          </button>
        </div>
      </div>
    </Modal>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<ActivityUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActivityUser | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/activity?days=${days}`)
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#0A2540]">Users</h3>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="h-8 px-3 rounded-lg border border-[#E3E8EF] text-[12px] text-[#596780] focus:outline-none focus:border-[#0ABF53]"
        >
          <option value={1}>Last 24h</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={3650}>All time</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-[#96A0B5]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#E3E8EF] bg-[#F6F8FA]">
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-[#596780] uppercase tracking-wider">User</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-[#596780] uppercase tracking-wider hidden sm:table-cell">Company</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-[#596780] uppercase tracking-wider">Last Seen</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-[#596780] uppercase tracking-wider hidden md:table-cell">Pages</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-[#596780] uppercase tracking-wider hidden md:table-cell">Queries</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-[#596780] uppercase tracking-wider hidden lg:table-cell">Connections</th>
                  <th className="px-4 py-2.5 w-8"></th>
                  <th className="px-2 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <React.Fragment key={u.user_id}>
                    <tr
                      className="border-b border-[#F0F3F7] hover:bg-[#F6F8FA] transition-colors cursor-pointer"
                      onClick={() => setExpanded(expanded === u.user_id ? null : u.user_id)}
                    >
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-medium text-[#0A2540]">{u.full_name || u.email.split("@")[0]}</p>
                        <p className="text-[10px] text-[#96A0B5]">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#596780] hidden sm:table-cell">{u.company_name || "—"}</td>
                      <td className="px-4 py-3 text-[12px] text-[#596780] tabular-nums">{u.last_seen ? relativeTime(u.last_seen) : "Never"}</td>
                      <td className="px-4 py-3 text-[12px] font-medium text-[#0A2540] tabular-nums hidden md:table-cell">{u.total_views}</td>
                      <td className="px-4 py-3 text-[12px] font-medium text-[#0A2540] tabular-nums hidden md:table-cell">{u.query_count}</td>
                      <td className="px-4 py-3 text-[12px] font-medium text-[#0A2540] tabular-nums hidden lg:table-cell">{u.total_connections.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <ChevronDown className={`w-3.5 h-3.5 text-[#96A0B5] transition-transform ${expanded === u.user_id ? "rotate-180" : ""}`} />
                      </td>
                      <td className="px-2 py-3">
                        {!u.email.endsWith("@incommon.ai") && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(u);
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title={`Delete ${u.full_name || u.email}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded === u.user_id && (
                      <tr>
                        <td colSpan={8} className="bg-[#F6F8FA] px-6 py-4">
                          <div className="space-y-3">
                            {/* Page views */}
                            <div>
                              <p className="text-[11px] font-semibold text-[#596780] uppercase tracking-wider mb-1.5">Page Views</p>
                              <div className="flex flex-wrap gap-3 text-[12px]">
                                {["dashboard", "hit-list", "network", "ask", "settings", "admin"].map((pg) => (
                                  <span key={pg} className="text-[#596780]">
                                    {pg === "hit-list" ? "Hit List" : pg === "ask" ? "Ask Circl" : pg.charAt(0).toUpperCase() + pg.slice(1)}: <strong className="text-[#0A2540]">{u.page_views[pg] || 0}</strong>
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Sessions */}
                            {u.sessions.length > 0 && (
                              <div>
                                <p className="text-[11px] font-semibold text-[#596780] uppercase tracking-wider mb-1.5">Recent Sessions</p>
                                <div className="space-y-1.5">
                                  {u.sessions.slice(0, 5).map((s, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[12px]">
                                      <Clock className="w-3 h-3 text-[#96A0B5] shrink-0" />
                                      <span className="text-[#596780]">
                                        {new Date(s.started).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                                        {new Date(s.started).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                      </span>
                                      <span className="text-[#0A2540]">
                                        {s.pages.filter((p, j, a) => a.indexOf(p) === j).join(" → ")}
                                      </span>
                                      <span className="text-[#96A0B5]">({s.duration_minutes || "<1"}min)</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Pipeline & ICP */}
                            <div className="flex flex-wrap gap-4 text-[12px] text-[#596780]">
                              <span>{u.total_connections.toLocaleString()} connections</span>
                              <span>{u.enriched_count.toLocaleString()} enriched</span>
                              <span>{u.hits_count} hits</span>
                              <span>Joined {new Date(u.joined).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-[#96A0B5]">No users found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteTarget && (
        <DeleteUserModal
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(userId) => {
            setUsers((prev) => prev.filter((u) => u.user_id !== userId));
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queries Tab
// ---------------------------------------------------------------------------

interface QueryLogEntry {
  id: string;
  user_id: string;
  full_name: string;
  company_name: string;
  question: string;
  display_type: string;
  results_count: number;
  answer_preview: string;
  follow_ups: string[];
  duration_ms: number;
  created_at: string;
}

function QueriesTab() {
  const [queries, setQueries] = useState<QueryLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [totalQueries, setTotalQueries] = useState(0);
  const [avgResults, setAvgResults] = useState(0);
  const [mostActive, setMostActive] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/queries?days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        setQueries(d.queries || []);
        setTotalQueries(d.total_queries || 0);
        setAvgResults(d.avg_results || 0);
        setMostActive(d.most_active_user || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#0A2540]">Query Log</h3>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="h-8 px-3 rounded-lg border border-[#E3E8EF] text-[12px] text-[#596780] focus:outline-none focus:border-[#0ABF53]"
        >
          <option value={1}>Last 24h</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={3650}>All time</option>
        </select>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 text-[13px] text-[#596780]">
        <span>Total: <strong className="text-[#0A2540]">{totalQueries}</strong></span>
        <span>Avg results: <strong className="text-[#0A2540]">{avgResults}</strong></span>
        {mostActive && <span>Most active: <strong className="text-[#0A2540]">{mostActive}</strong></span>}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-[#96A0B5]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#E3E8EF] bg-[#F6F8FA]">
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-[#596780] uppercase tracking-wider">User</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-[#596780] uppercase tracking-wider">Question</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-[#596780] uppercase tracking-wider hidden sm:table-cell">Time</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold text-[#596780] uppercase tracking-wider hidden md:table-cell">Results</th>
                  <th className="px-4 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {queries.map((q) => (
                  <React.Fragment key={q.id}>
                    <tr
                      className="border-b border-[#F0F3F7] hover:bg-[#F6F8FA] transition-colors cursor-pointer"
                      onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="text-[12px] font-medium text-[#0A2540]">{q.full_name?.split(" ")[0] || "Unknown"}</p>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#0A2540] max-w-[300px] truncate">
                        &ldquo;{q.question}&rdquo;
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[#96A0B5] tabular-nums hidden sm:table-cell">{relativeTime(q.created_at)}</td>
                      <td className="px-4 py-3 text-[12px] font-medium text-[#0A2540] tabular-nums hidden md:table-cell">{q.results_count}</td>
                      <td className="px-4 py-3">
                        <ChevronDown className={`w-3.5 h-3.5 text-[#96A0B5] transition-transform ${expanded === q.id ? "rotate-180" : ""}`} />
                      </td>
                    </tr>
                    {expanded === q.id && (
                      <tr>
                        <td colSpan={5} className="bg-[#F6F8FA] px-6 py-4">
                          <div className="space-y-2 text-[12px]">
                            <div className="flex flex-wrap gap-3 text-[#596780]">
                              <span>User: <strong className="text-[#0A2540]">{q.full_name || "Unknown"}</strong> · {q.company_name}</span>
                              <span>Time: {new Date(q.created_at).toLocaleString()}</span>
                              <span>Duration: {q.duration_ms ? `${(q.duration_ms / 1000).toFixed(1)}s` : "—"}</span>
                              <span>Results: {q.results_count}</span>
                              <span>Display: {q.display_type || "—"}</span>
                            </div>
                            {q.answer_preview && (
                              <div>
                                <p className="text-[11px] font-semibold text-[#596780] uppercase tracking-wider mb-1">Answer</p>
                                <p className="text-[#596780] leading-relaxed">{q.answer_preview}</p>
                              </div>
                            )}
                            {q.follow_ups && q.follow_ups.length > 0 && (
                              <div>
                                <p className="text-[11px] font-semibold text-[#596780] uppercase tracking-wider mb-1">Follow-ups</p>
                                <div className="flex flex-wrap gap-2">
                                  {q.follow_ups.map((fu, i) => (
                                    <span key={i} className="text-[11px] px-2 py-1 rounded-full bg-white border border-[#E3E8EF] text-[#596780]">
                                      {fu}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {queries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-[#96A0B5]">No queries found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Admin Dashboard with Tabs
// ---------------------------------------------------------------------------

const ADMIN_TABS = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "pipeline", label: "Pipeline", icon: <Activity className="w-4 h-4" /> },
  { id: "users", label: "Users", icon: <Users className="w-4 h-4" /> },
  { id: "queries", label: "Queries", icon: <MessageSquare className="w-4 h-4" /> },
] as const;

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<string>("overview");

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-[#0A2540]">Admin Dashboard</h1>

      {/* Tabs */}
      <div className="border-b border-[#E3E8EF] overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {ADMIN_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-[#0ABF53] text-[#0A2540]"
                  : "border-transparent text-[#596780] hover:text-[#0A2540] hover:border-[#E3E8EF]"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "pipeline" && <PipelineTab />}
      {activeTab === "users" && <UsersTab />}
      {activeTab === "queries" && <QueriesTab />}
    </div>
  );
}
