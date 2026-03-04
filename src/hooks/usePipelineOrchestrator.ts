"use client";

import { useState, useEffect, useRef } from "react";

export type PipelineStep =
  | "checking"
  | "classifying"
  | "enriching"
  | "matching"
  | "completed"
  | "error";

export interface PipelineState {
  step: PipelineStep;
  total: number;
  classified: number;
  enriched: number;
  isRunning: boolean;
  error: string | null;
}

const DELAY_MS = 1000;
const MAX_CONSECUTIVE_ERRORS = 3;

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function usePipelineOrchestrator(
  userId: string,
  initialProcessingStatus: string | null | undefined
): PipelineState {
  const [state, setState] = useState<PipelineState>({
    step: initialProcessingStatus === "completed" ? "completed" : "checking",
    total: 0,
    classified: 0,
    enriched: 0,
    isRunning: false,
    error: null,
  });

  const hasStartedRef = useRef(false);

  useEffect(() => {
    // Don't run if already completed
    if (initialProcessingStatus === "completed") return;
    // Don't run twice
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    let aborted = false;

    async function fetchStatus() {
      const res = await fetch(`/api/pipeline/status?userId=${userId}`);
      if (!res.ok) throw new Error("Failed to fetch pipeline status");
      return res.json() as Promise<{
        status: string;
        progress: number;
        total: number;
        classified: number;
        enriched: number;
      }>;
    }

    async function runClassify() {
      let consecutiveErrors = 0;

      while (!aborted) {
        try {
          const res = await fetch("/api/pipeline/classify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, offset: 0 }),
          });

          if (!res.ok) {
            const errData = await res
              .json()
              .catch(() => ({ error: "Unknown error" }));
            throw new Error(
              errData.error || `Classify failed: ${res.status}`
            );
          }

          const result = await res.json();
          consecutiveErrors = 0;

          // Poll status for updated counts
          const status = await fetchStatus();
          setState((prev) => ({
            ...prev,
            classified: status.classified,
            total: status.total,
          }));

          if (!result.hasMore) break;
          await wait(DELAY_MS);
        } catch (err) {
          console.error("Classify batch error:", err);
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.error(
              `Too many classify errors (${MAX_CONSECUTIVE_ERRORS}), moving on`
            );
            break;
          }
          await wait(DELAY_MS * 2);
        }
      }
    }

    async function runEnrich() {
      let consecutiveErrors = 0;

      while (!aborted) {
        try {
          const res = await fetch("/api/pipeline/enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          });

          if (!res.ok) {
            const errData = await res
              .json()
              .catch(() => ({ error: "Unknown error" }));
            throw new Error(
              errData.error || `Enrich failed: ${res.status}`
            );
          }

          const result = await res.json();
          consecutiveErrors = 0;

          // Poll status for updated counts
          const status = await fetchStatus();
          setState((prev) => ({
            ...prev,
            enriched: status.enriched,
          }));

          if (!result.hasMore) break;
          await wait(DELAY_MS);
        } catch (err) {
          console.error("Enrich batch error:", err);
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.error(
              `Too many enrich errors (${MAX_CONSECUTIVE_ERRORS}), moving on`
            );
            break;
          }
          await wait(DELAY_MS * 2);
        }
      }
    }

    async function runPipeline() {
      setState((prev) => ({ ...prev, isRunning: true }));

      try {
        // Check current status to determine where to resume
        const status = await fetchStatus();
        setState((prev) => ({
          ...prev,
          total: status.total,
          classified: status.classified,
          enriched: status.enriched,
        }));

        // Already completed
        if (status.status === "completed") {
          setState((prev) => ({
            ...prev,
            step: "completed",
            isRunning: false,
          }));
          return;
        }

        // No connections to process
        if (status.total === 0) {
          setState((prev) => ({
            ...prev,
            step: "completed",
            isRunning: false,
          }));
          return;
        }

        // Step 1: Classify (if any pending)
        if (status.classified < status.total) {
          setState((prev) => ({ ...prev, step: "classifying" }));
          await runClassify();
          if (aborted) return;
        }

        // Step 2: Enrich
        setState((prev) => ({ ...prev, step: "enriching" }));
        await runEnrich();
        if (aborted) return;

        // Step 3: Match (Phase 2 placeholder)
        setState((prev) => ({ ...prev, step: "matching" }));
        try {
          const matchRes = await fetch("/api/pipeline/match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          });
          // If route doesn't exist (404), that's OK — skip
          if (matchRes.ok) {
            // Match ran successfully
          }
        } catch {
          // Match route doesn't exist yet, skip
        }
        if (aborted) return;

        // Step 4: Mark pipeline complete
        await fetch("/api/pipeline/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });

        setState((prev) => ({
          ...prev,
          step: "completed",
          isRunning: false,
        }));
      } catch (err) {
        console.error("Pipeline orchestrator error:", err);
        setState((prev) => ({
          ...prev,
          step: "error",
          error: err instanceof Error ? err.message : "Pipeline failed",
          isRunning: false,
        }));
      }
    }

    runPipeline();

    return () => {
      aborted = true;
    };
  }, [userId, initialProcessingStatus]);

  return state;
}
