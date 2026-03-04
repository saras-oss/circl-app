"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Database, Brain, Bell, ArrowRight, PartyPopper } from "lucide-react";

interface WhatHappensNextProps {
  userId: string;
  connectionCount?: number;
  onContinue: () => void;
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
}: WhatHappensNextProps) {
  const [loading, setLoading] = useState(false);

  async function handleGoToDashboard() {
    setLoading(true);
    // Pipeline orchestrator on the dashboard handles classify → enrich → match
    onContinue();
  }

  return (
    <div className="animate-fade-in flex flex-col items-center text-center space-y-10">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-accent/10 animate-scale-in">
          <PartyPopper className="h-7 w-7 text-accent" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            You&apos;re all set!
          </h1>
          <p className="text-sm sm:text-base text-warm-500 max-w-md mx-auto leading-relaxed">
            Here&apos;s what happens next.{connectionCount > 0 && (
              <> Estimated time: <strong className="text-foreground">{getTimeEstimate(connectionCount)}</strong>.</>
            )}
          </p>
        </div>
      </div>

      {/* Steps with connecting vertical line */}
      <div className="w-full relative stagger-children">
        {/* Vertical connecting line */}
        <div
          className="absolute left-7 sm:left-8 top-[72px] bottom-[72px] w-px bg-gradient-to-b from-accent/40 via-accent/20 to-accent/40 hidden sm:block"
          aria-hidden="true"
        />
        <div
          className="absolute left-7 top-[72px] bottom-[72px] w-px bg-gradient-to-b from-accent/40 via-accent/20 to-accent/40 sm:hidden"
          aria-hidden="true"
        />

        <div className="space-y-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={index}
                className="card-elevated p-5 sm:p-6 flex items-start gap-5 text-left relative"
              >
                {/* Number + icon column */}
                <div className="flex flex-col items-center gap-2 shrink-0 relative z-10">
                  <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-accent/10">
                    <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-accent" strokeWidth={1.5} />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white shrink-0">
                      {index + 1}
                    </span>
                    <h3 className="text-base sm:text-lg font-semibold text-foreground">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-sm text-warm-500 leading-relaxed">
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
        className="w-full h-[56px] rounded-2xl bg-accent text-white font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all text-base shadow-lg shadow-accent/20"
      >
        Go to Dashboard
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
