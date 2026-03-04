"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Settings,
  Shield,
  Download,
  CheckSquare,
  Mail,
  Upload,
  ArrowLeft,
  CheckCircle,
  LinkIcon,
} from "lucide-react";

interface ExportGuideStepProps {
  userId: string;
  onNext: () => void;
  onBack: () => void;
}

const guideSteps = [
  {
    number: 1,
    icon: Settings,
    title: "Go to LinkedIn",
    description:
      "Click your profile photo in the top right, then select Settings & Privacy.",
  },
  {
    number: 2,
    icon: Shield,
    title: "Data Privacy",
    description:
      'In the left sidebar, click "Data Privacy."',
  },
  {
    number: 3,
    icon: Download,
    title: "Get a Copy",
    description:
      'Under "How LinkedIn uses your data," click "Get a copy of your data."',
  },
  {
    number: 4,
    icon: CheckSquare,
    title: "Select Connections",
    description:
      'Choose "Connections" only (not full archive). Click "Request archive."',
  },
  {
    number: 5,
    icon: Mail,
    title: "Wait for Email",
    description:
      "LinkedIn sends a download link. Usually 10\u201330 minutes, can take up to 24 hours.",
  },
  {
    number: 6,
    icon: Upload,
    title: "Come Back and Upload",
    description:
      'Download the ZIP, extract "Connections.csv," and upload it to Circl.',
  },
];

export default function ExportGuideStep({
  userId,
  onNext,
  onBack,
}: ExportGuideStepProps) {
  const supabase = createClient();

  const [hasRequested, setHasRequested] = useState<boolean | null>(null);
  const [emailReminder, setEmailReminder] = useState(false);
  const [mobileNumber, setMobileNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleYes() {
    setHasRequested(true);
    await saveExportStatus(true);
  }

  async function handleRequestedNow() {
    setHasRequested(true);
    await saveExportStatus(true);
  }

  async function saveExportStatus(requested: boolean) {
    setSaving(true);
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from("users")
        .update({ has_requested_export: requested })
        .eq("id", userId);
      if (dbError) throw dbError;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save export status"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleContinue() {
    setSaving(true);
    setError(null);
    try {
      const updates: Record<string, unknown> = {
        email_reminder_opted_in: emailReminder,
      };
      if (mobileNumber.trim()) {
        updates.mobile_number = mobileNumber.trim();
      }
      const { error: dbError } = await supabase
        .from("users")
        .update(updates)
        .eq("id", userId);
      if (dbError) throw dbError;
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 animate-scale-in">
          <LinkIcon className="h-7 w-7 text-accent" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Export your LinkedIn connections
          </h1>
          <p className="text-sm sm:text-base text-warm-500 max-w-md mx-auto leading-relaxed">
            Follow these steps to download your connections from LinkedIn.
          </p>
        </div>
      </div>

      {/* Guide steps with stagger animation */}
      <div className="stagger-children space-y-3">
        {guideSteps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.number}
              className="card-elevated p-4 sm:p-5 flex items-start gap-4"
            >
              {/* Accent-colored number */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                  {step.number}
                </span>
              </div>

              {/* Icon + content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warm-100 text-warm-600">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-foreground">
                    {step.title}
                  </h3>
                </div>
                <p className="text-sm text-warm-500 leading-relaxed pl-12">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Question: Have you requested? (initial state) */}
      {hasRequested === null && (
        <div className="card-elevated p-6 sm:p-8 space-y-5 animate-fade-in-up">
          <p className="text-base font-semibold text-foreground text-center">
            Have you already requested the export from LinkedIn?
          </p>
          <div className="grid grid-cols-2 gap-4">
            {/* Yes card-button */}
            <button
              onClick={handleYes}
              disabled={saving}
              className="card-interactive p-5 sm:p-6 flex flex-col items-center gap-3 cursor-pointer min-h-[44px] active:scale-[0.98] transition-all"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                <CheckCircle className="h-6 w-6 text-accent" strokeWidth={1.5} />
              </div>
              <span className="text-sm font-semibold text-foreground">Yes, I have</span>
              <span className="text-xs text-warm-400">Ready to continue</span>
            </button>

            {/* No card-button */}
            <button
              onClick={() => setHasRequested(false)}
              disabled={saving}
              className="card-interactive p-5 sm:p-6 flex flex-col items-center gap-3 cursor-pointer min-h-[44px] active:scale-[0.98] transition-all"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warm-100">
                <Download className="h-6 w-6 text-warm-500" strokeWidth={1.5} />
              </div>
              <span className="text-sm font-semibold text-foreground">Not yet</span>
              <span className="text-xs text-warm-400">I need to do this</span>
            </button>
          </div>
        </div>
      )}

      {/* Not yet requested */}
      {hasRequested === false && (
        <div className="card-elevated p-6 sm:p-8 space-y-5 animate-fade-in-up">
          <p className="text-sm text-warm-500 leading-relaxed text-center">
            Follow the steps above to request your LinkedIn data export, then
            come back here.
          </p>
          <Button
            onClick={handleRequestedNow}
            size="lg"
            className="w-full h-[52px] rounded-2xl bg-accent text-white font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all"
            loading={saving}
          >
            I&apos;ve requested it
          </Button>
        </div>
      )}

      {/* Already requested - success + reminder options */}
      {hasRequested === true && (
        <div className="card-elevated p-6 sm:p-8 space-y-5 animate-fade-in-up">
          <div className="rounded-2xl bg-accent-light border border-accent/20 p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-accent shrink-0" />
            <p className="text-sm font-medium text-accent">
              Great! Your data should be ready soon.
            </p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-warm-50 transition-colors min-h-[44px]">
            <input
              type="checkbox"
              checked={emailReminder}
              onChange={(e) => setEmailReminder(e.target.checked)}
              className="h-5 w-5 rounded border-border-strong text-accent focus:ring-accent accent-accent"
            />
            <span className="text-sm text-warm-600">
              Email me a reminder when it&apos;s likely ready
            </span>
          </label>

          <Input
            label="Mobile Number (optional)"
            placeholder="+1 (555) 123-4567"
            type="tel"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            helperText="We'll only use this to notify you when your export is ready"
            className="h-[52px] rounded-2xl border-2 border-border input-ring"
          />

          <Button
            onClick={handleContinue}
            size="lg"
            className="w-full h-[52px] rounded-2xl bg-accent text-white font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all"
            loading={saving}
          >
            Continue to upload
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-4 text-sm text-destructive animate-fade-in">
          {error}
        </div>
      )}

      {/* Navigation */}
      {hasRequested === null && (
        <div className="flex gap-3">
          <Button
            onClick={onBack}
            variant="outline"
            size="lg"
            className="h-[52px] rounded-2xl border-2 border-border hover:border-border-strong transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={onNext}
            size="lg"
            className="flex-1 h-[52px] rounded-2xl bg-accent text-white font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all"
          >
            Continue
          </Button>
        </div>
      )}

      {hasRequested !== null && (
        <Button
          onClick={onBack}
          variant="ghost"
          size="lg"
          className="h-[52px] rounded-2xl min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      )}
    </div>
  );
}
