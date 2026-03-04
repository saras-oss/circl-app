"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Briefcase } from "lucide-react";

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
    <div className="animate-fade-in space-y-8">
      {/* Branded illustration header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 animate-scale-in">
          <User className="h-7 w-7 text-accent" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Tell us about yourself
          </h1>
          <p className="text-sm sm:text-base text-warm-500 max-w-md mx-auto leading-relaxed">
            We&apos;ll use this to personalize your experience and find the right
            connections for you.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal details card */}
        <div className="card-elevated p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-accent" strokeWidth={2} />
            <span className="text-xs font-semibold uppercase tracking-wider text-warm-400">
              Personal Details
            </span>
          </div>

          <div className="space-y-5">
            <Input
              label="Full Name"
              placeholder="Jane Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={fieldErrors.fullName}
              className="h-[52px] rounded-2xl border-2 border-border input-ring"
            />

            <Input
              label="LinkedIn URL"
              placeholder="https://linkedin.com/in/janesmith"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              error={fieldErrors.linkedinUrl}
              className="h-[52px] rounded-2xl border-2 border-border input-ring"
            />

            <Input
              label="Role / Title"
              placeholder="Head of Business Development"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              error={fieldErrors.roleTitle}
              className="h-[52px] rounded-2xl border-2 border-border input-ring"
            />
          </div>
        </div>

        {/* Company details card */}
        <div className="card-elevated p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="h-4 w-4 text-accent" strokeWidth={2} />
            <span className="text-xs font-semibold uppercase tracking-wider text-warm-400">
              Company Details
            </span>
          </div>

          <div className="space-y-5">
            <Input
              label="Company Name"
              placeholder="Acme Inc."
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              error={fieldErrors.companyName}
              className="h-[52px] rounded-2xl border-2 border-border input-ring"
            />

            <Input
              label="Company Website URL"
              placeholder="https://acme.com"
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
              helperText="Optional, but helps us understand your business"
              className="h-[52px] rounded-2xl border-2 border-border input-ring"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-4 text-sm text-destructive animate-fade-in">
            {error}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          loading={saving}
          className="w-full h-[52px] rounded-2xl bg-accent text-white font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all"
        >
          Continue
        </Button>
      </form>
    </div>
  );
}
