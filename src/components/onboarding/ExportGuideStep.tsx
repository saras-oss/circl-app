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
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 animate-scale-in">
            <CheckCircle
              className="h-7 w-7 text-accent"
              strokeWidth={1.5}
            />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Your LinkedIn export should be ready!
            </h1>
            <p className="text-sm sm:text-base text-warm-500 max-w-md mx-auto leading-relaxed">
              Download it from the email LinkedIn sent you, then upload the
              Connections.csv file below.
            </p>
          </div>
        </div>

        <div className="card-elevated p-6 space-y-4">
          <div className="rounded-2xl bg-accent-light border border-accent/20 p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-accent shrink-0" />
            <p className="text-sm font-medium text-accent">
              Export requested. Check your email for LinkedIn&apos;s download
              link.
            </p>
          </div>

          <Button
            onClick={onNext}
            size="lg"
            className="w-full h-[52px] rounded-2xl bg-accent text-white font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all"
          >
            I already have my data
            <ArrowRight className="h-4 w-4" />
          </Button>

          <button
            onClick={() => setIsReEntry(false)}
            className="w-full text-center text-sm text-warm-400 hover:text-warm-600 transition-colors py-1"
          >
            I still need to export
          </button>
        </div>

        {error && (
          <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-4 text-sm text-destructive animate-fade-in">
            {error}
          </div>
        )}

        <Button
          onClick={onBack}
          variant="ghost"
          size="lg"
          className="h-[52px] rounded-2xl min-h-[44px]"
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
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 animate-scale-in">
          <ExternalLink
            className="h-7 w-7 text-accent"
            strokeWidth={1.5}
          />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Export your LinkedIn connections
          </h1>
          <p className="text-sm sm:text-base text-warm-500 max-w-md mx-auto leading-relaxed">
            We need your connections data to analyze your network.
          </p>
        </div>
      </div>

      {/* Direct link */}
      <a
        href="https://www.linkedin.com/mypreferences/d/download-my-data"
        target="_blank"
        rel="noopener noreferrer"
        className="card-interactive p-5 flex items-center gap-4 text-accent font-bold text-base min-h-[56px] border-2 border-accent/20 hover:border-accent/40 transition-all"
      >
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
          <ExternalLink
            className="h-5 w-5 text-accent"
            strokeWidth={1.5}
          />
        </div>
        <span className="flex-1">
          Click here to export your data from LinkedIn
        </span>
        <ArrowRight className="h-4 w-4 shrink-0" />
      </a>

      {/* Split layout: steps (40%) + GIF placeholder (60%) */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Steps */}
        <div className="md:w-[40%] space-y-1">
          {directSteps.map((step, i) => (
            <div key={i} className="flex items-start gap-3 py-2.5">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-warm-600 leading-relaxed">{step}</p>
            </div>
          ))}
        </div>

        {/* GIF placeholder */}
        <div className="md:w-[60%]">
          <div className="card-elevated overflow-hidden min-h-[350px] md:min-h-[400px] border-2 border-dashed border-warm-200 rounded-2xl flex items-center justify-center">
            {/* Replace this placeholder with: <img src="/images/linkedin-export-guide.gif" alt="LinkedIn export walkthrough" className="max-w-full rounded-xl" /> */}
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 bg-warm-100 rounded-2xl flex items-center justify-center mb-4">
                <ExternalLink
                  className="h-7 w-7 text-warm-400"
                  strokeWidth={1.5}
                />
              </div>
              <p className="text-sm text-warm-400">
                Video walkthrough coming soon
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Accordion: manual steps */}
      <div className="card-elevated overflow-hidden">
        <button
          onClick={() => setShowManualSteps(!showManualSteps)}
          className="w-full flex items-center justify-between p-4 text-sm font-medium text-warm-500 hover:text-foreground transition-colors min-h-[44px]"
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
          <div className="border-t border-border p-4 space-y-3 animate-fade-in">
            {manualSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warm-200 text-[11px] font-bold text-warm-600 mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {step.title}
                  </p>
                  <p className="text-xs text-warm-500 mt-0.5">
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
        <div className="card-elevated p-4 text-center animate-fade-in">
          <div className="rounded-2xl bg-accent-light border border-accent/20 p-4 flex items-center gap-3">
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
          className="w-full h-[52px] rounded-2xl bg-accent text-white font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all"
        >
          I&apos;ve requested the export
        </Button>
        <Button
          onClick={onNext}
          variant="outline"
          size="lg"
          className="w-full h-[52px] rounded-2xl border-2 border-border hover:border-border-strong transition-all"
        >
          I already have my data
          <ArrowRight className="h-4 w-4" />
        </Button>
        <button
          onClick={handleDoLater}
          className="w-full text-center text-sm text-warm-400 hover:text-warm-600 transition-colors py-2"
        >
          I&apos;ll do this later
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-4 text-sm text-destructive animate-fade-in">
          {error}
        </div>
      )}

      <Button
        onClick={onBack}
        variant="ghost"
        size="lg"
        className="h-[52px] rounded-2xl min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* ─── Reminder Modal ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !reminderSaved && setShowModal(false)}
          />

          <div className="relative w-full max-w-md mx-4 rounded-2xl bg-surface shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-base font-bold text-foreground">
                {reminderSaved
                  ? "You\u2019re all set!"
                  : "We\u2019ll remind you"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-warm-100 flex items-center justify-center"
              >
                <X className="h-4 w-4 text-warm-500" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {!reminderSaved ? (
                <>
                  <p className="text-sm text-warm-500 leading-relaxed">
                    LinkedIn usually takes{" "}
                    <strong className="text-foreground">
                      10&ndash;30 minutes
                    </strong>{" "}
                    to prepare your file. We&apos;ll remind you when it&apos;s
                    time to download.
                  </p>

                  <Input
                    label="Your mobile number (optional)"
                    placeholder="+1 (555) 123-4567"
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="h-[52px] rounded-2xl border-2 border-border input-ring"
                  />

                  <Button
                    onClick={() => handleSaveReminder(false)}
                    size="lg"
                    loading={saving}
                    className="w-full h-[52px] rounded-2xl bg-accent text-white font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all"
                  >
                    Remind me
                  </Button>

                  <button
                    onClick={() => handleSaveReminder(true)}
                    className="w-full text-center text-sm text-warm-400 hover:text-warm-600 transition-colors py-1"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      Just remind me over email
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <div className="rounded-2xl bg-accent-light border border-accent/20 p-4 flex items-center gap-3 animate-fade-in">
                    <CheckCircle className="h-5 w-5 text-accent shrink-0" />
                    <p className="text-sm font-medium text-accent">
                      We&apos;ve saved your progress. We&apos;ll let you know
                      when your file is ready.
                    </p>
                  </div>

                  <Button
                    onClick={() => setShowModal(false)}
                    size="lg"
                    className="w-full h-[44px] rounded-2xl bg-accent text-white font-semibold hover:bg-accent/90 transition-all"
                  >
                    Got it
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
