"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ProfileStepProps {
  userId: string;
  userData: Record<string, unknown>;
  onNext: () => void;
}

export default function ProfileStep({ userId, userData, onNext }: ProfileStepProps) {
  const [fullName, setFullName] = useState(
    (userData.full_name as string) || ""
  );
  const [linkedinUrl, setLinkedinUrl] = useState(
    (userData.linkedin_url as string) || ""
  );
  const [companyName, setCompanyName] = useState(
    (userData.company_name as string) || ""
  );
  const [companyWebsite, setCompanyWebsite] = useState(
    (userData.company_website as string) || ""
  );
  const [roleTitle, setRoleTitle] = useState(
    (userData.role_title as string) || ""
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) {
      errors.fullName = "Full name is required";
    }
    if (!linkedinUrl.trim()) {
      errors.linkedinUrl = "LinkedIn URL is required";
    }
    if (!companyName.trim()) {
      errors.companyName = "Company name is required";
    }
    if (!roleTitle.trim()) {
      errors.roleTitle = "Role/Title is required";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          fullName: fullName.trim(),
          linkedinUrl: linkedinUrl.trim(),
          companyName: companyName.trim(),
          companyWebsite: companyWebsite.trim(),
          roleTitle: roleTitle.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save profile");
      }

      if (companyWebsite.trim()) {
        fetch("/api/onboarding/website-scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            websiteUrl: companyWebsite.trim(),
          }),
        });
      }

      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Tell us about yourself
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          We&apos;ll use this to personalize your experience and find the right
          connections for you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <Input
            label="Full Name"
            placeholder="Jane Smith"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={fieldErrors.fullName}
            className="h-12 rounded-xl"
          />

          <Input
            label="LinkedIn URL"
            placeholder="https://linkedin.com/in/janesmith"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            error={fieldErrors.linkedinUrl}
            className="h-12 rounded-xl"
          />

          <Input
            label="Company Name"
            placeholder="Acme Inc."
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            error={fieldErrors.companyName}
            className="h-12 rounded-xl"
          />

          <Input
            label="Company Website URL"
            placeholder="https://acme.com"
            value={companyWebsite}
            onChange={(e) => setCompanyWebsite(e.target.value)}
            helperText="Optional, but helps us understand your business"
            className="h-12 rounded-xl"
          />

          <Input
            label="Role / Title"
            placeholder="Head of Business Development"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            error={fieldErrors.roleTitle}
            className="h-12 rounded-xl"
          />
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          loading={saving}
          className="w-full rounded-xl"
        >
          Continue
        </Button>
      </form>
    </div>
  );
}
