"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import ProfileStep from "@/components/onboarding/ProfileStep";
import ExportGuideStep from "@/components/onboarding/ExportGuideStep";
import CsvUploadStep from "@/components/onboarding/CsvUploadStep";
import IcpReveal from "@/components/onboarding/IcpReveal";
import IcpStep from "@/components/onboarding/IcpStep";
// PaymentStep skipped for V1 — all users get full processing
import WhatHappensNext from "@/components/onboarding/WhatHappensNext";

const stepLabels = [
  "Profile",
  "Export Guide",
  "Upload CSV",
  "ICP Reveal",
  "Define ICP",
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<Record<string, unknown>>({});
  const [uploadResult, setUploadResult] = useState<{ mode: string; connections: number; tracking_token?: string } | null>(null);
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

    // If still no profile (user was fully deleted via SQL), sign out and redirect
    if (!profile) {
      await supabase.auth.signOut();
      router.push("/login");
      return;
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
    // Re-fetch user data before entering ICP steps so website_scrape_data is fresh
    if (newStep === 4 || newStep === 5) {
      await refreshUserData();
    }
    setStep(newStep);
    await supabase
      .from("users")
      .update({ onboarding_step: newStep })
      .eq("id", userId);
  }

  async function completeOnboarding() {
    setStep(7);
  }

  async function finishOnboarding() {
    await supabase
      .from("users")
      .update({ onboarding_completed: true, onboarding_step: 7 })
      .eq("id", userId);
    router.push("/dashboard");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 border-[2.5px] border-[#635BFF] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#596780] font-medium">
            Loading your workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Progress header */}
      {step <= 5 && (
        <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-[#E3E8EF]">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#0A2540] flex items-center justify-center">
                  <span className="text-white font-bold text-[10px]">C</span>
                </div>
                <span className="font-bold text-sm tracking-tight">
                  Circl
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#596780]">
                  {Math.min(step, 5)}/5
                </span>
                <span className="text-xs text-[#96A0B5]">
                  {stepLabels[Math.min(step, 5) - 1]}
                </span>
              </div>
            </div>
            {/* Step indicators */}
            <div className="flex gap-1.5">
              {stepLabels.map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-1 rounded-full overflow-hidden bg-[#E3E8EF]"
                >
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      i + 1 <= step ? "bg-[#635BFF]" : "bg-transparent"
                    }`}
                    style={{
                      width:
                        i + 1 < step
                          ? "100%"
                          : i + 1 === step
                            ? "50%"
                            : "0%",
                    }}
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
              onNext={(result) => {
                if (result) setUploadResult(result);
                updateStep(4);
              }}
              onBack={() => updateStep(2)}
            />
          )}
          {step === 4 && (
            <IcpReveal
              userData={userData}
              onNext={() => updateStep(5)}
              onBack={() => updateStep(3)}
            />
          )}
          {step === 5 && (
            <IcpStep
              userId={userId}
              userData={userData}
              onNext={completeOnboarding}
              onBack={() => updateStep(4)}
            />
          )}
          {/* Payment step skipped for V1 — all users get full processing */}
          {(step === 6 || step === 7) && (
            <WhatHappensNext
              userId={userId}
              connectionCount={(userData.total_connections as number) || 0}
              onContinue={finishOnboarding}
              uploadResult={uploadResult}
            />
          )}
        </div>
      </div>
    </div>
  );
}
