"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Database, Brain, Bell, ArrowRight, PartyPopper } from "lucide-react";

interface WhatHappensNextProps {
  userId: string;
  connectionCount?: number;
  onContinue: () => void;
  uploadResult?: { mode: string; connections: number; tracking_token?: string } | null;
}

function getTimeEstimate(connectionCount: number): string {
  if (connectionCount <= 100) return "1\u20132 minutes";
  if (connectionCount <= 500) return "3\u20135 minutes";
  if (connectionCount <= 1000) return "5\u201310 minutes";
  return "10\u201315 minutes";
}

const steps = [
  {
    icon: Database,
    title: "Classifying & enriching",
    description:
      "We're classifying your connections by seniority and pulling deep data \u2014 work history, company details, funding signals, and more.",
  },
  {
    icon: Brain,
    title: "Scoring against your ICP",
    description:
      "Our AI scores every connection against your ideal customer profile to surface your best potential customers and investors.",
  },
  {
    icon: Bell,
    title: "Results ready on your dashboard",
    description:
      "Head to your dashboard to see results in real time. Your Hit List will populate as scoring completes.",
  },
];

export default function WhatHappensNext({
  userId,
  connectionCount = 0,
  onContinue,
  uploadResult,
}: WhatHappensNextProps) {
  const [loading, setLoading] = useState(false);
  const isBackground = uploadResult?.mode === 'background';

  async function handleGoToDashboard() {
    setLoading(true);
    // Pipeline orchestrator on the dashboard handles classify → enrich → match
    onContinue();
  }

  if (isBackground) {
    return (
      <div className="animate-fade-in flex flex-col items-center text-center space-y-10">
        <div className="space-y-4">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-xl bg-[#FFFBEB] animate-scale-in">
            <PartyPopper className="h-7 w-7 text-[#D97706]" strokeWidth={1.5} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A2540]">
              We&apos;re on it!
            </h1>
            <p className="text-sm sm:text-base text-[#596780] max-w-md mx-auto leading-relaxed">
              Processing <strong className="text-[#0A2540]">{(uploadResult.connections || connectionCount).toLocaleString()} connections</strong> takes
              a bit longer. We&apos;ll email you when your hit list is ready.
            </p>
          </div>
        </div>

        <div className="w-full bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-6 sm:p-8 space-y-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF2FF] shrink-0">
              <Bell className="h-6 w-6 text-[#635BFF]" strokeWidth={1.5} />
            </div>
            <div className="text-left">
              <h3 className="text-base font-semibold text-[#0A2540] mb-1">What happens now?</h3>
              <p className="text-sm text-[#596780] leading-relaxed">
                Our AI is classifying, enriching, and scoring every connection in the background.
                You&apos;ll get an email at 50% progress and when it&apos;s complete.
              </p>
            </div>
          </div>
        </div>

        <div className="w-full space-y-3">
          {uploadResult.tracking_token && (
            <a
              href={`/track/${uploadResult.tracking_token}`}
              className="block w-full h-[52px] rounded-xl border border-[#E3E8EF] bg-white text-sm font-semibold text-[#0A2540] hover:border-[#596780] transition-all flex items-center justify-center gap-2"
            >
              Track progress
              <ArrowRight className="h-4 w-4" />
            </a>
          )}
          <Button
            onClick={handleGoToDashboard}
            size="lg"
            loading={loading}
            className="w-full h-[56px] rounded-xl bg-[#0A2540] text-white font-semibold hover:bg-[#0A2540]/90 active:scale-[0.98] transition-all text-base shadow-lg shadow-[#0A2540]/20"
          >
            Go to Dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col items-center text-center space-y-10">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-xl bg-[#FFFBEB] animate-scale-in">
          <PartyPopper className="h-7 w-7 text-[#D97706]" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A2540]">
            You&apos;re all set!
          </h1>
          <p className="text-sm sm:text-base text-[#596780] max-w-md mx-auto leading-relaxed">
            Here&apos;s what happens next.{connectionCount > 0 && (
              <> Estimated time: <strong className="text-[#0A2540]">{getTimeEstimate(connectionCount)}</strong>.</>
            )}
          </p>
        </div>
      </div>

      {/* Steps with connecting vertical line */}
      <div className="w-full relative stagger-children">
        {/* Vertical connecting line */}
        <div
          className="absolute left-7 sm:left-8 top-[72px] bottom-[72px] w-px bg-gradient-to-b from-[#635BFF]/30 via-[#635BFF]/15 to-[#635BFF]/30 hidden sm:block"
          aria-hidden="true"
        />
        <div
          className="absolute left-7 top-[72px] bottom-[72px] w-px bg-gradient-to-b from-[#635BFF]/30 via-[#635BFF]/15 to-[#635BFF]/30 sm:hidden"
          aria-hidden="true"
        />

        <div className="space-y-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={index}
                className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-5 sm:p-6 flex items-start gap-5 text-left relative"
              >
                {/* Number + icon column */}
                <div className="flex flex-col items-center gap-2 shrink-0 relative z-10">
                  <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl bg-[#EEF2FF]">
                    <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-[#635BFF]" strokeWidth={1.5} />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#0A2540] text-xs font-bold text-white shrink-0">
                      {index + 1}
                    </span>
                    <h3 className="text-base sm:text-lg font-semibold text-[#0A2540]">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-sm text-[#596780] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <Button
        onClick={handleGoToDashboard}
        size="lg"
        loading={loading}
        className="w-full h-[56px] rounded-xl bg-[#0A2540] text-white font-semibold hover:bg-[#0A2540]/90 active:scale-[0.98] transition-all text-base shadow-lg shadow-[#0A2540]/20"
      >
        Go to Dashboard
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
