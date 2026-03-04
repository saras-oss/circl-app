"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Database, Brain, Bell } from "lucide-react";

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

    fetch("/api/pipeline/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    onContinue();
  }

  return (
    <div className="flex flex-col items-center text-center space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          You&apos;re all set!
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Here&apos;s what happens next while you wait.
        </p>
      </div>

      <div className="w-full space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div
              key={index}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm flex items-start gap-4 text-left"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                <Icon className="h-5 w-5 text-gray-600" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {step.title}
                  </h3>
                </div>
                <p className="text-sm text-gray-500">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Button
        onClick={handleGoToDashboard}
        size="lg"
        loading={loading}
        className="w-full rounded-xl"
      >
        Go to Dashboard
      </Button>
    </div>
  );
}
