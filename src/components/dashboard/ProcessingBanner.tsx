"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Zap } from "lucide-react";

interface ProcessingStatus {
  status: string;
  progress: number;
  total: number;
  classified: number;
  enriched: number;
}

export default function ProcessingBanner({ userId }: { userId: string }) {
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const supabase = createClient();

  const fetchStatus = useCallback(async () => {
    const { data } = await supabase
      .from("users")
      .select(
        "processing_status, processing_progress, total_connections, enriched_connections"
      )
      .eq("id", userId)
      .single();

    if (data) {
      const { data: classifiedCount } = await supabase
        .from("user_connections")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("classification_status", "classified");

      setStatus({
        status: data.processing_status,
        progress: data.processing_progress,
        total: data.total_connections,
        classified: classifiedCount?.length ?? 0,
        enriched: data.enriched_connections,
      });
    }
  }, [supabase, userId]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (!status || status.status === "idle" || status.status === "completed") {
    return null;
  }

  const statusLabels: Record<string, string> = {
    classifying: "Classifying your connections",
    enriching: "Enriching profiles with deep data",
    matching: "Finding your best matches",
    failed: "Processing encountered an error",
  };

  const statusDescriptions: Record<string, string> = {
    classifying: "Analyzing seniority, function, and decision-maker signals",
    enriching: "Pulling work history, company details, and funding data",
    matching: "Scoring connections against your ideal customer profile",
    failed: "Please try again or contact support",
  };

  return (
    <div className="card-elevated p-5 mb-6 animate-fade-in border-accent/20">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-accent-light rounded-xl flex items-center justify-center shrink-0">
          {status.status !== "failed" ? (
            <div className="w-5 h-5 border-[2.5px] border-accent border-t-transparent rounded-full animate-spin" />
          ) : (
            <Zap className="w-5 h-5 text-destructive" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">
              {statusLabels[status.status] || "Processing..."}
            </p>
            <span className="text-xs font-bold text-accent">{status.progress}%</span>
          </div>
          <p className="text-xs text-warm-500 mt-0.5">
            {statusDescriptions[status.status]}
          </p>
          <div className="mt-3 h-1.5 bg-warm-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
