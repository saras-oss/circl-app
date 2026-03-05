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
      <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-6 mb-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-[2.5px] border-[#0ABF53] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-[#0A2540]">
            Checking pipeline status...
          </p>
        </div>
      </div>
    );
  }

  const currentStepIndex = getStepIndex(state.step);
  const progress = getOverallProgress(state);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-6 mb-6 animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-[#0A2540]">
          Analyzing your network...
        </h3>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 text-xs font-medium text-[#96A0B5] hover:text-[#0A2540] transition-colors"
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
                <CheckCircle className="w-5 h-5 text-[#0ABF53] shrink-0" />
              ) : isActive ? (
                <Loader2 className="w-5 h-5 text-[#0ABF53] shrink-0 animate-spin" />
              ) : (
                <Circle className="w-5 h-5 text-[#D1D9E6] shrink-0" />
              )}

              <span
                className={`text-sm font-medium flex-1 ${
                  isDone || isActive ? "text-[#0A2540]" : "text-[#96A0B5]"
                }`}
              >
                {stepConfig.label}
              </span>

              <span
                className={`text-xs font-semibold tabular-nums ${
                  isDone || isActive ? "text-[#0ABF53]" : "text-[#D1D9E6]"
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

      <div className="h-1.5 bg-[#F0F3F7] rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%`, background: "linear-gradient(90deg, #0ABF53, #34D399)" }}
        />
      </div>

      <p className="text-xs text-[#96A0B5] text-center">
        This usually takes 2-5 minutes
      </p>

      {state.error && (
        <div className="mt-3 rounded-lg bg-[#FDE8EC] border border-[#ED5F74]/20 p-3 text-xs text-[#ED5F74]">
          {state.error}
        </div>
      )}
    </div>
  );
}
