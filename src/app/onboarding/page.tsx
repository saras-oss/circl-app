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

const stepLabels = ["Profile", "Export Guide", "Upload CSV", "Define ICP", "Payment"];

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

    let { data: profile } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    // If no public.users row exists, create it (handles deleted users or missing trigger)
    if (!profile) {
      await fetch("/api/auth/ensure-profile", { method: "POST" });
      const { data: newProfile } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();
      profile = newProfile;
    }

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

  async function refreshUserData() {
    const { data: profile } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();
    if (profile) {
      setUserData(profile);
    }
    return profile;
  }

  async function updateStep(newStep: number) {
    // Re-fetch user data before entering ICP step (step 4) so website_scrape_data is fresh
    if (newStep === 4) {
      await refreshUserData();
    }
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 border-[2.5px] border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-warm-500 font-medium">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Progress header */}
      {step <= 5 && (
        <div className="sticky top-0 z-50 glass border-b border-border">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
                  <span className="text-white font-bold text-[10px]">C</span>
                </div>
                <span className="font-bold text-sm tracking-tight">Circl</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-warm-500">
                  {step}/5
                </span>
                <span className="text-xs text-warm-400">
                  {stepLabels[step - 1]}
                </span>
              </div>
            </div>
            {/* Step indicators */}
            <div className="flex gap-1.5">
              {stepLabels.map((_, i) => (
                <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-warm-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      i + 1 <= step ? "bg-accent" : "bg-transparent"
                    }`}
                    style={{ width: i + 1 < step ? "100%" : i + 1 === step ? "50%" : "0%" }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-fade-in">
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
    </div>
  );
}
