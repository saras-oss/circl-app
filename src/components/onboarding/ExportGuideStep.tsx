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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Export your LinkedIn connections
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Follow these steps to download your connections from LinkedIn.
        </p>
      </div>

      <div className="space-y-3">
        {guideSteps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.number}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm flex items-start gap-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                    {step.number}
                  </span>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {hasRequested === null && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <p className="text-sm font-medium text-gray-900">
            Have you already requested the export from LinkedIn?
          </p>
          <div className="flex gap-3">
            <Button
              onClick={handleYes}
              size="lg"
              className="flex-1 rounded-xl"
              loading={saving}
            >
              Yes
            </Button>
            <Button
              onClick={() => setHasRequested(false)}
              variant="outline"
              size="lg"
              className="flex-1 rounded-xl"
            >
              No
            </Button>
          </div>
        </div>
      )}

      {hasRequested === false && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <p className="text-sm text-gray-500">
            Follow the steps above to request your LinkedIn data export, then
            come back here.
          </p>
          <Button
            onClick={handleRequestedNow}
            size="lg"
            className="w-full rounded-xl"
            loading={saving}
          >
            I&apos;ve requested it
          </Button>
        </div>
      )}

      {hasRequested === true && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="rounded-xl bg-green-50 border border-green-200 p-4">
            <p className="text-sm font-medium text-green-800">
              Great! Your data should be ready soon.
            </p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={emailReminder}
              onChange={(e) => setEmailReminder(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            <span className="text-sm text-gray-700">
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
            className="h-12 rounded-xl"
          />

          <Button
            onClick={handleContinue}
            size="lg"
            className="w-full rounded-xl"
            loading={saving}
          >
            Continue to upload
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {hasRequested === null && (
        <div className="flex gap-3">
          <Button
            onClick={onBack}
            variant="outline"
            size="lg"
            className="rounded-xl"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={onNext}
            size="lg"
            className="flex-1 rounded-xl"
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
          className="rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      )}
    </div>
  );
}
