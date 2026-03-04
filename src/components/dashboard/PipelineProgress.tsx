"use client";

import { CheckCircle, Loader2, Circle, RefreshCw } from "lucide-react";
import {
  type PipelineState,
  type PipelineStep,
} from "@/hooks/usePipelineOrchestrator";

interface StepConfig {
  key: PipelineStep;
  label: string;
  getDetail: (state: PipelineState) => string;
}

const pipelineSteps: StepConfig[] = [
  {
    key: "classifying",
    label: "Classifying connections",
    getDetail: (s) =>
      s.total > 0
        ? `${s.classified}/${s.total} (${Math.round((s.classified / s.total) * 100)}%)`
        : "Starting...",
  },
  {
    key: "enriching",
    label: "Enriching profiles",
    getDetail: (s) =>
      s.enriched > 0 ? `${s.enriched} enriched` : "Starting...",
  },
  {
    key: "scoring",
    label: "Scoring matches",
    getDetail: (s) =>
      s.scored > 0 ? `${s.scored} scored` : "Starting...",
  },
];

const stepOrder: PipelineStep[] = ["classifying", "enriching", "scoring"];

function getStepIndex(step: PipelineStep): number {
  return stepOrder.indexOf(step);
}

function getOverallProgress(state: PipelineState): number {
  const { step, classified, total } = state;

  if (step === "completed") return 100;
  if (step === "checking" || step === "error") return 0;

  const currentIndex = getStepIndex(step);
  if (currentIndex === -1) return 0;

  const portions = [35, 45, 20];
  let progress = 0;

  for (let i = 0; i < currentIndex; i++) {
    progress += portions[i];
  }

  if (step === "classifying" && total > 0) {
    progress += (classified / total) * portions[0];
  } else if (step === "enriching") {
    progress += portions[1] * 0.5;
  } else if (step === "scoring") {
    progress += portions[2] * 0.5;
  }

  return Math.min(Math.round(progress), 99);
}

export default function PipelineProgress({
  state,
  onRefresh,
}: {
  state: PipelineState;
  onRefresh?: () => void;
}) {
  if (state.step === "completed") return null;

  if (state.step === "checking") {
    return (
      <div className="card-elevated p-6 mb-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-[2.5px] border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-foreground">
            Checking pipeline status...
          </p>
        </div>
      </div>
    );
  }

  const currentStepIndex = getStepIndex(state.step);
  const progress = getOverallProgress(state);

  return (
    <div className="card-elevated p-6 mb-6 animate-fade-in border-accent/20">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-foreground">
          Analyzing your network...
        </h3>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 text-xs font-medium text-warm-400 hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        )}
      </div>

      <div className="space-y-3.5 mb-5">
        {pipelineSteps.map((stepConfig, i) => {
          const isDone = currentStepIndex > i;
          const isActive = stepConfig.key === state.step;

          return (
            <div key={stepConfig.key} className="flex items-center gap-3">
              {isDone ? (
                <CheckCircle className="w-5 h-5 text-accent shrink-0" />
              ) : isActive ? (
                <Loader2 className="w-5 h-5 text-accent shrink-0 animate-spin" />
              ) : (
                <Circle className="w-5 h-5 text-warm-300 shrink-0" />
              )}

              <span
                className={`text-sm font-medium flex-1 ${
                  isDone || isActive ? "text-foreground" : "text-warm-400"
                }`}
              >
                {stepConfig.label}
              </span>

              <span
                className={`text-xs font-semibold tabular-nums ${
                  isDone || isActive ? "text-accent" : "text-warm-300"
                }`}
              >
                {isDone
                  ? "Done"
                  : isActive
                    ? stepConfig.getDetail(state)
                    : "\u2014 waiting"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-warm-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-xs text-warm-400 text-center">
        This usually takes 2\u20135 minutes
      </p>

      {state.error && (
        <div className="mt-3 rounded-xl bg-destructive/5 border border-destructive/20 p-3 text-xs text-destructive">
          {state.error}
        </div>
      )}
    </div>
  );
}
