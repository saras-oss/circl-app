"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  X,
  Mail,
} from "lucide-react";

interface ExportGuideStepProps {
  userId: string;
  onNext: () => void;
  onBack: () => void;
}

const directSteps = [
  "Click the link above (opens LinkedIn)",
  'Select "Download larger data archive" (it\'s the first option)',
  'Click "Request archive"',
  "Wait for LinkedIn\u2019s email (usually 10\u201330 min)",
  'Download the ZIP, find "Connections.csv" inside',
  "Come back here and upload it",
];

const manualSteps = [
  {
    title: "Open LinkedIn on your desktop",
    description: "Go to linkedin.com and sign in to your account.",
  },
  {
    title: "Go to Settings & Privacy",
    description:
      "Click your profile photo in the top right, then select Settings & Privacy.",
  },
  {
    title: "Navigate to Data Privacy",
    description:
      'In the left sidebar, click "Data Privacy" then "Get a copy of your data."',
  },
  {
    title: 'Select "Connections" only',
    description:
      'Choose "Connections" only (not full archive). Click "Request archive."',
  },
  {
    title: "Wait for LinkedIn\u2019s email",
    description:
      "LinkedIn sends a download link. Usually 10\u201330 minutes, can take up to 24 hours.",
  },
  {
    title: "Download and come back",
    description:
      'Download the ZIP, extract "Connections.csv," and upload it in the next step.',
  },
];

export default function ExportGuideStep({
  userId,
  onNext,
  onBack,
}: ExportGuideStepProps) {
  const supabase = createClient();
  const [showModal, setShowModal] = useState(false);
  const [showManualSteps, setShowManualSteps] = useState(false);
  const [mobileNumber, setMobileNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminderSaved, setReminderSaved] = useState(false);
  const [isReEntry, setIsReEntry] = useState(false);
  const [showLaterMessage, setShowLaterMessage] = useState(false);

  // Check re-entry state
  useEffect(() => {
    async function checkPriorState() {
      const { data } = await supabase
        .from("users")
        .select("has_requested_export")
        .eq("id", userId)
        .single();
      if (data?.has_requested_export) {
        setIsReEntry(true);
      }
    }
    checkPriorState();
  }, [supabase, userId]);

  async function handleRequestedExport() {
    setShowModal(true);
  }

  async function handleSaveReminder(emailOnly?: boolean) {
    setSaving(true);
    setError(null);
    try {
      const updates: Record<string, unknown> = {
        has_requested_export: true,
        email_reminder_opted_in: true,
      };
      if (!emailOnly && mobileNumber.trim()) {
        updates.mobile_number = mobileNumber.trim();
      }
      const { error: dbError } = await supabase
        .from("users")
        .update(updates)
        .eq("id", userId);
      if (dbError) throw dbError;
      setReminderSaved(true);
      setTimeout(() => setShowModal(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDoLater() {
    // The onboarding_step is already saved as step 2
    // Mark export as requested so they see re-entry view when they return
    await supabase
      .from("users")
      .update({ has_requested_export: true })
      .eq("id", userId);
    setShowLaterMessage(true);
  }

  /* ─── Re-entry view ─── */
  if (isReEntry) {
    return (
      <div className="animate-fade-in space-y-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#E6F9EE] animate-scale-in">
            <CheckCircle
              className="h-7 w-7 text-[#0ABF53]"
              strokeWidth={1.5}
            />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A2540]">
              Your LinkedIn export should be ready!
            </h1>
            <p className="text-sm sm:text-base text-[#596780] max-w-md mx-auto leading-relaxed">
              Download it from the email LinkedIn sent you, then upload the
              Connections.csv file below.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-6 space-y-4">
          <div className="rounded-xl bg-accent-light border border-accent/20 p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-accent shrink-0" />
            <p className="text-sm font-medium text-accent">
              Export requested. Check your email for LinkedIn&apos;s download
              link.
            </p>
          </div>

          <Button
            onClick={onNext}
            size="lg"
            className="w-full h-[52px] rounded-lg bg-[#0A2540] text-white font-semibold hover:bg-[#0A2540]/90 active:scale-[0.98] transition-all"
          >
            I already have my data
            <ArrowRight className="h-4 w-4" />
          </Button>

          <button
            onClick={() => setIsReEntry(false)}
            className="w-full text-center text-sm text-[#96A0B5] hover:text-[#596780] transition-colors py-1"
          >
            I still need to export
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 text-sm text-destructive animate-fade-in">
            {error}
          </div>
        )}

        <Button
          onClick={onBack}
          variant="ghost"
          size="lg"
          className="h-[52px] rounded-lg min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
    );
  }

  /* ─── Default view ─── */
  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#FFF4ED] animate-scale-in">
          <ExternalLink
            className="h-7 w-7 text-[#E8590C]"
            strokeWidth={1.5}
          />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A2540]">
            Export your LinkedIn connections
          </h1>
          <p className="text-sm sm:text-base text-[#596780] max-w-md mx-auto leading-relaxed">
            We need your connections data to analyze your network.
          </p>
        </div>
      </div>

      {/* Direct link */}
      <a
        href="https://www.linkedin.com/mypreferences/d/download-my-data"
        target="_blank"
        rel="noopener noreferrer"
        className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] hover:shadow-md p-5 flex items-center gap-4 text-[#0A2540] font-bold text-base min-h-[56px] hover:border-[#635BFF]/40 transition-all"
      >
        <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center shrink-0">
          <ExternalLink
            className="h-5 w-5 text-[#635BFF]"
            strokeWidth={1.5}
          />
        </div>
        <span className="flex-1">
          Click here to export your data from LinkedIn
        </span>
        <ArrowRight className="h-4 w-4 text-[#635BFF] shrink-0" />
      </a>

      {/* Split layout: steps (40%) + GIF placeholder (60%) */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Steps */}
        <div className="md:w-[40%] space-y-1">
          {directSteps.map((step, i) => (
            <div key={i} className="flex items-start gap-3 py-2.5">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0A2540] text-[11px] font-bold text-white mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-[#596780] leading-relaxed">{step}</p>
            </div>
          ))}
        </div>

        {/* GIF walkthrough */}
        <div className="md:w-[60%]">
          <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] overflow-hidden">
            <img
              src="/guides/linkedin-export-guide.gif"
              alt="How to export LinkedIn connections"
              className="w-full"
              loading="lazy"
            />
          </div>
        </div>
      </div>

      {/* Accordion: manual steps */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] overflow-hidden">
        <button
          onClick={() => setShowManualSteps(!showManualSteps)}
          className="w-full flex items-center justify-between p-4 text-sm font-medium text-[#596780] hover:text-[#0A2540] transition-colors min-h-[44px]"
        >
          <span>
            Export another way (if the link above doesn&apos;t work)
          </span>
          {showManualSteps ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {showManualSteps && (
          <div className="border-t border-[#E3E8EF] p-4 space-y-3 animate-fade-in">
            {manualSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E3E8EF] text-[11px] font-bold text-[#596780] mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#0A2540]">
                    {step.title}
                  </p>
                  <p className="text-xs text-[#596780] mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* "Do later" confirmation */}
      {showLaterMessage && (
        <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-4 text-center animate-fade-in">
          <div className="rounded-xl bg-accent-light border border-accent/20 p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-accent shrink-0" />
            <p className="text-sm font-medium text-accent">
              Your progress is saved. Come back anytime to continue.
            </p>
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className="space-y-3">
        <Button
          onClick={handleRequestedExport}
          size="lg"
          className="w-full h-[52px] rounded-lg bg-[#0A2540] text-white font-semibold hover:bg-[#0A2540]/90 active:scale-[0.98] transition-all"
        >
          I&apos;ve requested the export
        </Button>
        <Button
          onClick={onNext}
          variant="outline"
          size="lg"
          className="w-full h-[52px] rounded-lg border border-[#E3E8EF] hover:border-[#D1D9E6] transition-all"
        >
          I already have my data
          <ArrowRight className="h-4 w-4" />
        </Button>
        <button
          onClick={handleDoLater}
          className="w-full text-center text-sm text-[#96A0B5] hover:text-[#596780] transition-colors py-2"
        >
          I&apos;ll do this later
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 text-sm text-destructive animate-fade-in">
          {error}
        </div>
      )}

      <Button
        onClick={onBack}
        variant="ghost"
        size="lg"
        className="h-[52px] rounded-lg min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* ─── Reminder Modal ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0, 0, 0, 0.5)" }}>
          <div
            className="absolute inset-0"
            onClick={() => !reminderSaved && setShowModal(false)}
          />

          <div className="relative w-[90vw] sm:min-w-[480px] max-w-lg rounded-xl bg-white overflow-hidden" style={{ boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-8 pt-8 pb-0">
              <h2 className="text-base font-bold text-[#0A2540]">
                {reminderSaved
                  ? "You\u2019re all set!"
                  : "We\u2019ll remind you"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-[#F0F3F7] flex items-center justify-center"
              >
                <X className="h-4 w-4 text-[#596780]" />
              </button>
            </div>

            <div className="p-8 space-y-5">
              {!reminderSaved ? (
                <>
                  <p className="text-sm text-[#596780] leading-relaxed">
                    LinkedIn usually takes{" "}
                    <strong className="text-[#0A2540]">
                      10&ndash;30 minutes
                    </strong>{" "}
                    to prepare your file. We&apos;ll remind you when it&apos;s
                    time to download.
                  </p>

                  <Input
                    label="Your mobile number"
                    placeholder="+91 98765 43210"
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="h-[52px] rounded-xl border border-[#E3E8EF] focus:border-[#635BFF] focus:ring-2 focus:ring-[#635BFF]/20 outline-none"
                  />

                  <Button
                    onClick={() => handleSaveReminder(false)}
                    size="lg"
                    loading={saving}
                    className="w-full h-[52px] rounded-lg bg-[#0A2540] text-white font-semibold hover:bg-[#0A2540]/90 active:scale-[0.98] transition-all"
                  >
                    Remind me
                  </Button>

                  <button
                    onClick={() => handleSaveReminder(true)}
                    className="w-full text-center text-sm text-[#96A0B5] hover:text-[#596780] transition-colors py-1"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      Just remind me over email
                    </span>
                  </button>
                </>
              ) : (
                <div className="rounded-xl bg-accent-light border border-accent/20 p-4 flex items-center gap-3 animate-fade-in">
                  <CheckCircle className="h-5 w-5 text-accent shrink-0" />
                  <p className="text-sm font-medium text-accent">
                    Saved! We&apos;ll let you know when your file is ready.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
