"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import ProfileStep from "@/components/onboarding/ProfileStep";
import ExportGuideStep from "@/components/onboarding/ExportGuideStep";
import CsvUploadStep from "@/components/onboarding/CsvUploadStep";
import IcpStep from "@/components/onboarding/IcpStep";
import PaymentStep from "@/components/onboarding/PaymentStep";
import WhatHappensNext from "@/components/onboarding/WhatHappensNext";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<Record<string, unknown>>({});
  const router = useRouter();
  const supabase = createClient();

  const loadUser = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profile) {
      setUserData(profile);
      if (profile.onboarding_completed) {
        router.push("/dashboard");
        return;
      }
      setStep(profile.onboarding_step || 1);
    }
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  async function updateStep(newStep: number) {
    setStep(newStep);
    await supabase
      .from("users")
      .update({ onboarding_step: newStep })
      .eq("id", userId);
  }

  async function completeOnboarding() {
    setStep(6);
  }

  async function finishOnboarding() {
    await supabase
      .from("users")
      .update({ onboarding_completed: true, onboarding_step: 6 })
      .eq("id", userId);
    router.push("/dashboard");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse-slow text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Progress bar */}
      {step <= 5 && (
        <div className="sticky top-0 z-50 bg-white border-b">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Step {step} of 5</span>
              <span className="text-xs text-muted-foreground">
                {
                  ["Profile", "Export Guide", "Upload CSV", "Define ICP", "Payment"][
                    step - 1
                  ]
                }
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-8">
        {step === 1 && (
          <ProfileStep
            userId={userId}
            userData={userData}
            onNext={() => updateStep(2)}
          />
        )}
        {step === 2 && (
          <ExportGuideStep
            userId={userId}
            onNext={() => updateStep(3)}
            onBack={() => updateStep(1)}
          />
        )}
        {step === 3 && (
          <CsvUploadStep
            userId={userId}
            onNext={() => updateStep(4)}
            onBack={() => updateStep(2)}
          />
        )}
        {step === 4 && (
          <IcpStep
            userId={userId}
            userData={userData}
            onNext={() => updateStep(5)}
            onBack={() => updateStep(3)}
          />
        )}
        {step === 5 && (
          <PaymentStep
            userId={userId}
            userData={userData}
            onComplete={completeOnboarding}
            onBack={() => updateStep(4)}
          />
        )}
        {step === 6 && (
          <WhatHappensNext userId={userId} onContinue={finishOnboarding} />
        )}
      </div>
    </div>
  );
}
