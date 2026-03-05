"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle,
  Loader2,
  ArrowRight,
  Users,
  Brain,
  Building2,
  Target,
  Clock,
} from "lucide-react";

interface PipelineJob {
  id: string;
  status: string;
  total_connections: number;
  classified_count: number;
  enriched_persons_count: number;
  enriched_companies_count: number;
  scored_count: number;
  hits_count: number;
  skipped_count: number;
  estimated_completion: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  users: { full_name: string | null; company_name: string | null } | null;
}

function formatTimeRemaining(eta: string): string {
  const diff = new Date(eta).getTime() - Date.now();
  if (diff <= 0) return "any moment now";
  const minutes = Math.ceil(diff / 60000);
  if (minutes <= 1) return "~1 minute";
  if (minutes < 60) return `~${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return `~${hours}h ${remainingMin}m`;
}

type StepKey = "classifying" | "enriching_persons" | "enriching_companies" | "scoring" | "completed";

const STEP_ORDER: StepKey[] = [
  "classifying",
  "enriching_persons",
  "enriching_companies",
  "scoring",
  "completed",
];

const STEP_META: Record<
  StepKey,
  { label: string; icon: typeof Users }
> = {
  classifying: { label: "Classifying connections", icon: Users },
  enriching_persons: { label: "Enriching profiles", icon: Brain },
  enriching_companies: { label: "Enriching companies", icon: Building2 },
  scoring: { label: "Scoring matches", icon: Target },
  completed: { label: "Complete", icon: CheckCircle },
};

export default function TrackPage() {
  const params = useParams();
  const token = params.token as string;
  const [job, setJob] = useState<PipelineJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/pipeline/track?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        setError(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setJob(data.job);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchJob();
    const interval = setInterval(fetchJob, 30000);
    return () => clearInterval(interval);
  }, [fetchJob]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8FA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-[#94A3B8] animate-spin" />
          <p className="text-sm text-[#596780]">Loading progress...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-[#F6F8FA] flex items-center justify-center px-6">
        <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-[#F0F3F7] rounded-xl flex items-center justify-center mx-auto mb-4">
            <Users className="h-7 w-7 text-[#94A3B8]" />
          </div>
          <h2 className="text-lg font-semibold text-[#0A2540] mb-2">Job not found</h2>
          <p className="text-sm text-[#596780]">
            This tracking link may have expired or is invalid.
          </p>
        </div>
      </div>
    );
  }

  const total = job.total_connections || 1;
  const processed =
    (job.classified_count || 0) +
    (job.enriched_persons_count || 0) +
    (job.scored_count || 0);
  const totalSteps = total * 3;
  const progress = Math.min(Math.round((processed / totalSteps) * 100), 100);
  const isComplete = job.status === "completed";
  const isFailed = job.status === "failed";
  const isPaused = job.status === "paused";
  const firstName = job.users?.full_name?.split(" ")[0] || "Your";

  return (
    <div className="min-h-screen bg-[#F6F8FA]">
      {/* Header */}
      <div className="bg-white border-b border-[#E3E8EF]">
        <div className="max-w-lg mx-auto px-6 py-5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0ABF53] flex items-center justify-center">
            <span className="text-white font-bold text-xs">C</span>
          </div>
          <span className="font-bold text-base tracking-tight text-[#0A2540]">Circl</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-10 space-y-8">
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A2540]">
            {isComplete
              ? `${firstName}'s hit list is ready!`
              : `Analyzing ${firstName}'s network`}
          </h1>
          <p className="text-sm text-[#596780]">
            {isComplete
              ? `${job.hits_count} strong matches found from ${total.toLocaleString()} connections.`
              : `Processing ${total.toLocaleString()} connections...`}
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#0A2540]">{progress}%</span>
            {job.estimated_completion && !isComplete && (
              <span className="text-[#596780] flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTimeRemaining(job.estimated_completion)}
              </span>
            )}
          </div>
          <div className="h-3 rounded-full bg-[#E3E8EF] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${progress}%`,
                background: isComplete
                  ? "#0ABF53"
                  : "linear-gradient(90deg, #0ABF53, #34D399)",
              }}
            />
          </div>
        </div>

        {/* Status badge */}
        {(isFailed || isPaused) && (
          <div
            className={`rounded-xl p-4 text-center text-sm font-medium ${
              isFailed
                ? "bg-[#FDE8EC] text-[#ED5F74] border border-[#ED5F74]/20"
                : "bg-[#FFF8E1] text-[#D97706] border border-[#D97706]/20"
            }`}
          >
            {isFailed
              ? "Processing encountered an error. Our team has been notified."
              : "Processing is paused. It will resume shortly."}
          </div>
        )}

        {/* Step checklist */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] divide-y divide-[#E3E8EF]">
          {STEP_ORDER.map((stepKey) => {
            const meta = STEP_META[stepKey];
            const Icon = meta.icon;
            const currentIdx = STEP_ORDER.indexOf(job.status as StepKey);
            const stepIdx = STEP_ORDER.indexOf(stepKey);
            const isDone = stepIdx < currentIdx || isComplete;
            const isActive = stepKey === job.status && !isComplete;

            let countText = "";
            if (stepKey === "classifying" && job.classified_count > 0) {
              countText = `${job.classified_count}/${total}`;
            } else if (stepKey === "enriching_persons" && job.enriched_persons_count > 0) {
              countText = `${job.enriched_persons_count}`;
            } else if (stepKey === "enriching_companies" && job.enriched_companies_count > 0) {
              countText = `${job.enriched_companies_count}`;
            } else if (stepKey === "scoring" && job.scored_count > 0) {
              countText = `${job.scored_count}/${total}`;
            }

            return (
              <div key={stepKey} className="flex items-center gap-4 px-5 py-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${
                    isDone
                      ? "bg-[#E6F9EE]"
                      : isActive
                        ? "bg-[#0ABF53]/10"
                        : "bg-[#F0F3F7]"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle className="h-5 w-5 text-[#0ABF53]" />
                  ) : isActive ? (
                    <Loader2 className="h-5 w-5 text-[#0ABF53] animate-spin" />
                  ) : (
                    <Icon className="h-5 w-5 text-[#94A3B8]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      isDone || isActive ? "text-[#0A2540]" : "text-[#96A0B5]"
                    }`}
                  >
                    {meta.label}
                  </p>
                </div>
                {countText && (
                  <span className="text-xs font-medium text-[#596780] bg-[#F0F3F7] px-2 py-1 rounded-md">
                    {countText}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Hits found */}
        {job.hits_count > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E6F9EE] shrink-0">
              <Target className="h-6 w-6 text-[#0ABF53]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#0A2540]">{job.hits_count}</p>
              <p className="text-sm text-[#596780]">
                {isComplete ? "matches found" : "matches found so far"}
              </p>
            </div>
          </div>
        )}

        {/* CTA */}
        {isComplete && (
          <a
            href="/dashboard/hit-list"
            className="flex items-center justify-center gap-2 w-full h-[52px] rounded-xl bg-[#0ABF53] text-white text-sm font-semibold hover:bg-[#0ABF53]/90 active:scale-[0.98] transition-all shadow-lg shadow-[#0ABF53]/20"
          >
            View your hit list
            <ArrowRight className="h-4 w-4" />
          </a>
        )}

        {/* Auto-refresh notice */}
        {!isComplete && !isFailed && (
          <p className="text-center text-xs text-[#96A0B5]">
            This page refreshes automatically every 30 seconds.
          </p>
        )}
      </div>
    </div>
  );
}
