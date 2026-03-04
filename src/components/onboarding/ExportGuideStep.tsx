"use client";

import { useState, useEffect } from "react";
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
  ArrowRight,
  CheckCircle,
  LinkIcon,
  ExternalLink,
  FileSpreadsheet,
} from "lucide-react";

interface ExportGuideStepProps {
  userId: string;
  onNext: () => void;
  onBack: () => void;
}

const guideSteps = [
  {
    number: 1,
    icon: ExternalLink,
    title: "Open LinkedIn on your desktop",
    description: "Go to linkedin.com and sign in to your account.",
  },
  {
    number: 2,
    icon: Settings,
    title: "Go to Settings & Privacy",
    description: "Click your profile photo in the top right, then select Settings & Privacy.",
  },
  {
    number: 3,
    icon: Shield,
    title: "Navigate to Data Privacy",
    description: 'In the left sidebar, click "Data Privacy" then "Get a copy of your data."',
  },
  {
    number: 4,
    icon: CheckSquare,
    title: 'Select "Connections" only',
    description: 'Choose "Connections" only (not full archive). Click "Request archive."',
  },
  {
    number: 5,
    icon: Mail,
    title: "Wait for LinkedIn\u2019s email",
    description: "LinkedIn sends a download link. Usually 10\u201330 minutes, can take up to 24 hours.",
  },
  {
    number: 6,
    icon: Download,
    title: "Download and come back",
    description: 'Download the ZIP, extract "Connections.csv," and upload it in the next step.',
  },
];

export default function ExportGuideStep({
  userId,
  onNext,
  onBack,
}: ExportGuideStepProps) {
  const supabase = createClient();

  // Screen state: "question" | "guide" | "waiting"
  const [screen, setScreen] = useState<"question" | "guide" | "waiting">("question");
  const [mobileNumber, setMobileNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminderSent, setReminderSent] = useState(false);

  // Check if user has already requested export on prior visit
  useEffect(() => {
    async function checkPriorState() {
      const { data } = await supabase
        .from("users")
        .select("has_requested_export")
        .eq("id", userId)
        .single();
      if (data?.has_requested_export) {
        setScreen("waiting");
      }
    }
    checkPriorState();
  }, [supabase, userId]);

  async function handleHasFile() {
    // User already has the file — skip to CSV upload
    onNext();
  }

  async function handleRequestedExport() {
    setSaving(true);
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from("users")
        .update({ has_requested_export: true })
        .eq("id", userId);
      if (dbError) throw dbError;
      setScreen("waiting");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveReminder() {
    setSaving(true);
    setError(null);
    try {
      const updates: Record<string, unknown> = {};
      if (mobileNumber.trim()) {
        updates.mobile_number = mobileNumber.trim();
      }
      updates.email_reminder_opted_in = true;
      const { error: dbError } = await supabase
        .from("users")
        .update(updates)
        .eq("id", userId);
      if (dbError) throw dbError;
      setReminderSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  /* ─── Screen 1: The Question ─── */
  if (screen === "question") {
    return (
      <div className="animate-fade-in space-y-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 animate-scale-in">
            <LinkIcon className="h-7 w-7 text-accent" strokeWidth={1.5} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Do you have your LinkedIn export?
            </h1>
            <p className="text-sm sm:text-base text-warm-500 max-w-md mx-auto leading-relaxed">
              We need your Connections.csv file from LinkedIn to analyze your network.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Yes */}
          <button
            onClick={handleHasFile}
            className="card-interactive p-6 sm:p-8 flex flex-col items-center gap-4 cursor-pointer min-h-[44px] active:scale-[0.98] transition-all"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
              <FileSpreadsheet className="h-7 w-7 text-accent" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <span className="text-base font-bold text-foreground block">Yes, I have my file</span>
              <span className="text-xs text-warm-400 mt-1 block">Ready to upload Connections.csv</span>
            </div>
          </button>

          {/* No */}
          <button
            onClick={() => setScreen("guide")}
            className="card-interactive p-6 sm:p-8 flex flex-col items-center gap-4 cursor-pointer min-h-[44px] active:scale-[0.98] transition-all"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warm-100">
              <Download className="h-7 w-7 text-warm-500" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <span className="text-base font-bold text-foreground block">No, I need to export</span>
              <span className="text-xs text-warm-400 mt-1 block">Show me how to get the file</span>
            </div>
          </button>
        </div>

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

  /* ─── Screen 2: Export Guide ─── */
  if (screen === "guide") {
    return (
      <div className="animate-fade-in space-y-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 animate-scale-in">
            <LinkIcon className="h-7 w-7 text-accent" strokeWidth={1.5} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              How to export your LinkedIn connections
            </h1>
            <p className="text-sm sm:text-base text-warm-500 max-w-md mx-auto leading-relaxed">
              Follow these steps, then come back to upload your file.
            </p>
          </div>
        </div>

        {/* Desktop: split layout, Mobile: stacked */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left: Steps (60%) */}
          <div className="md:w-[60%] space-y-3 stagger-children">
            {guideSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className="card-elevated p-4 flex items-start gap-4"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                    {step.number}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4 text-warm-500 shrink-0" strokeWidth={1.5} />
                      <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                    </div>
                    <p className="text-sm text-warm-500 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              );
            })}

            {/* Direct link */}
            <a
              href="https://www.linkedin.com/mypreferences/d/download-my-data"
              target="_blank"
              rel="noopener noreferrer"
              className="card-interactive p-4 flex items-center gap-3 text-accent font-semibold text-sm min-h-[44px]"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              Open LinkedIn Data Export directly
              <ArrowRight className="h-3.5 w-3.5 ml-auto" />
            </a>
          </div>

          {/* Right: GIF placeholder (40%) */}
          <div className="md:w-[40%]">
            <div className="card-elevated p-6 flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-warm-200">
              <div className="w-16 h-16 bg-warm-100 rounded-2xl flex items-center justify-center mb-4">
                <Upload className="h-7 w-7 text-warm-400" strokeWidth={1.5} />
              </div>
              <p className="text-sm text-warm-400 text-center">
                Video walkthrough coming soon
              </p>
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div className="card-elevated p-6 space-y-5">
          <p className="text-sm text-warm-500 text-center leading-relaxed">
            This usually takes <strong className="text-foreground">10&ndash;30 minutes</strong>. We&apos;ll remind you when it&apos;s ready.
          </p>

          <Input
            label="Your mobile number (optional)"
            placeholder="+1 (555) 123-4567"
            type="tel"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            helperText="We'll send a reminder when your export is ready"
            className="h-[52px] rounded-2xl border-2 border-border input-ring"
          />

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleRequestedExport}
              size="lg"
              loading={saving}
              className="flex-1 h-[52px] rounded-2xl bg-accent text-white font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all"
            >
              I&apos;ve requested the export
            </Button>
            <Button
              onClick={onNext}
              variant="outline"
              size="lg"
              className="h-[52px] rounded-2xl border-2 border-border hover:border-border-strong transition-all"
            >
              I already have my data
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-4 text-sm text-destructive animate-fade-in">
            {error}
          </div>
        )}

        <Button
          onClick={() => setScreen("question")}
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

  /* ─── Screen 3: Waiting / Re-entry ─── */
  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 animate-scale-in">
          <CheckCircle className="h-7 w-7 text-accent" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Your LinkedIn export should be ready
          </h1>
          <p className="text-sm sm:text-base text-warm-500 max-w-md mx-auto leading-relaxed">
            Check your email for a download link from LinkedIn, then upload the file below.
          </p>
        </div>
      </div>

      <div className="card-elevated p-6 space-y-5">
        <div className="rounded-2xl bg-accent-light border border-accent/20 p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-accent shrink-0" />
          <p className="text-sm font-medium text-accent">
            Export requested. Check your email for LinkedIn&apos;s download link.
          </p>
        </div>

        {!reminderSent && (
          <div className="space-y-4">
            <Input
              label="Your mobile number (optional)"
              placeholder="+1 (555) 123-4567"
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              helperText="We'll send a reminder when it's time"
              className="h-[52px] rounded-2xl border-2 border-border input-ring"
            />
            <Button
              onClick={handleSaveReminder}
              variant="outline"
              size="lg"
              loading={saving}
              className="w-full h-[44px] rounded-2xl border-2 border-border hover:border-border-strong transition-all text-sm"
            >
              <Mail className="h-4 w-4" />
              Send me an email reminder
            </Button>
          </div>
        )}

        {reminderSent && (
          <div className="rounded-2xl bg-warm-50 border border-warm-200 p-4 text-sm text-warm-600 text-center animate-fade-in">
            We&apos;ll remind you when your export is ready.
          </div>
        )}

        <Button
          onClick={onNext}
          size="lg"
          className="w-full h-[52px] rounded-2xl bg-accent text-white font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all"
        >
          Upload my file now
          <ArrowRight className="h-4 w-4" />
        </Button>
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
