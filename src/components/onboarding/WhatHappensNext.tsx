"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Database, Brain, Bell, ArrowRight, PartyPopper } from "lucide-react";

interface WhatHappensNextProps {
  userId: string;
  onContinue: () => void;
}

const steps = [
  {
    icon: Database,
    title: "Enriching your data",
    description:
      "We're pulling deep data on your connections \u2014 work history, company details, funding, investor profiles, and more.",
  },
  {
    icon: Brain,
    title: "Matching against your ICP",
    description:
      "Our AI is scoring every connection against your profile to find customers, investors, and advisors.",
  },
  {
    icon: Bell,
    title: "Results on the way",
    description:
      "We'll email you when your results are ready. Usually 15\u201330 minutes.",
  },
];

export default function WhatHappensNext({
  userId,
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
            Here&apos;s what happens next while you wait.
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
