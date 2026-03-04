"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { User, CreditCard, Target, Upload, Check, Sparkles } from "lucide-react";

interface SettingsClientProps {
  userId: string;
  profile: Record<string, unknown>;
  payment: Record<string, unknown> | null;
}

export default function SettingsClient({
  userId,
  profile,
  payment,
}: SettingsClientProps) {
  const [fullName, setFullName] = useState(
    (profile.full_name as string) || ""
  );
  const [linkedinUrl, setLinkedinUrl] = useState(
    (profile.linkedin_url as string) || ""
  );
  const [companyName, setCompanyName] = useState(
    (profile.company_name as string) || ""
  );
  const [companyWebsite, setCompanyWebsite] = useState(
    (profile.company_website as string) || ""
  );
  const [roleTitle, setRoleTitle] = useState(
    (profile.role_title as string) || ""
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    await supabase
      .from("users")
      .update({
        full_name: fullName,
        linkedin_url: linkedinUrl,
        company_name: companyName,
        company_website: companyWebsite,
        role_title: roleTitle,
      })
      .eq("id", userId);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const tierLabels: Record<string, string> = {
    free: "Free",
    starter: "Starter \u2014 $100/year",
    growth: "Growth \u2014 $300/year",
    scale: "Scale \u2014 $500/year",
    enterprise: "Enterprise \u2014 $700/year",
  };

  const inputClasses =
    "w-full h-[52px] px-4 rounded-2xl border-2 border-border bg-surface text-sm font-medium text-foreground placeholder:text-warm-400 input-ring transition-all";

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
      </div>

      <div className="space-y-6 stagger-children">
        {/* Profile */}
        <div className="card-elevated p-6 sm:p-8">
          <div className="flex items-center gap-3.5 mb-8">
            <div className="w-11 h-11 bg-accent-light rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Profile</h2>
              <p className="text-xs text-warm-400 font-medium">
                Your personal and company details
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-warm-400 mb-3 block">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClasses}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-warm-400 mb-3 block">
                LinkedIn URL
              </label>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                className={inputClasses}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-warm-400 mb-3 block">
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-warm-400 mb-3 block">
                  Role / Title
                </label>
                <input
                  type="text"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  className={inputClasses}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-warm-400 mb-3 block">
                Company Website
              </label>
              <input
                type="url"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
                className={inputClasses}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="h-[52px] px-8 rounded-2xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-all duration-150 disabled:opacity-50 active:scale-[0.98] flex items-center gap-2 min-w-[140px] justify-center"
            >
              {saving ? (
                "Saving..."
              ) : saved ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Saved!</span>
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </form>
        </div>

        {/* Subscription */}
        <div className="card-elevated p-6 sm:p-8">
          <div className="flex items-center gap-3.5 mb-8">
            <div className="w-11 h-11 bg-accent-light rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Subscription</h2>
              <p className="text-xs text-warm-400 font-medium">
                Your plan and billing details
              </p>
            </div>
          </div>

          <div className="space-y-0 divide-y divide-border/60">
            <div className="flex items-center justify-between py-4 first:pt-0">
              <span className="text-sm text-warm-500 font-medium">Plan</span>
              <span className="text-sm font-semibold text-foreground">
                {tierLabels[profile.subscription_tier as string] || "None"}
              </span>
            </div>
            <div className="flex items-center justify-between py-4">
              <span className="text-sm text-warm-500 font-medium">Status</span>
              <span
                className={`text-sm font-semibold ${profile.subscription_status === "active" ? "text-green" : "text-warm-400"}`}
              >
                {profile.subscription_status === "active"
                  ? "Active"
                  : "Inactive"}
              </span>
            </div>
            <div className="flex items-center justify-between py-4">
              <span className="text-sm text-warm-500 font-medium">
                Connections Analyzed
              </span>
              <span className="text-sm font-semibold text-foreground">
                {(
                  (profile.enriched_connections as number) || 0
                ).toLocaleString()}{" "}
                of{" "}
                {(
                  (profile.total_connections as number) || 0
                ).toLocaleString()}
              </span>
            </div>
            {payment && (
              <div className="flex items-center justify-between py-4 last:pb-0">
                <span className="text-sm text-warm-500 font-medium">
                  Last Payment
                </span>
                <span className="text-sm font-semibold text-foreground">
                  ${((payment.amount as number) / 100).toFixed(0)} on{" "}
                  {new Date(payment.created_at as string).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {profile.subscription_tier === "free" && (
            <div className="mt-6 p-5 rounded-2xl bg-gradient-to-br from-accent-light to-accent/5 border border-accent/10">
              <p className="text-sm font-semibold text-foreground">Upgrade your plan</p>
              <p className="text-xs text-warm-500 mt-1 leading-relaxed">
                Analyze all{" "}
                {(
                  (profile.total_connections as number) || 0
                ).toLocaleString()}{" "}
                connections in your network
              </p>
            </div>
          )}
        </div>

        {/* ICP */}
        <div className="card-elevated p-6 sm:p-8">
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-11 h-11 bg-accent-light rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Ideal Customer Profile</h2>
              <p className="text-xs text-warm-400 font-medium">
                Your targeting criteria for matches
              </p>
            </div>
          </div>
          {profile.icp_data &&
          Object.keys(profile.icp_data as object).length > 0 ? (
            <div className="space-y-5">
              {Object.entries(profile.icp_data as Record<string, unknown>).map(
                ([key, value]) => {
                  if (typeof value === "boolean" || !value) return null;
                  const label = key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (s) => s.toUpperCase());
                  return (
                    <div key={key}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-warm-400 mb-3">
                        {label}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(value) ? (
                          value.map((v: string) => (
                            <span
                              key={v}
                              className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-accent-light text-accent border border-accent/10"
                            >
                              {v}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-accent-light text-accent border border-accent/10">
                            {String(value)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm text-warm-400 font-medium">No ICP defined yet</p>
            </div>
          )}
        </div>

        {/* Re-upload CSV */}
        <div className="card-elevated p-6 sm:p-8">
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-11 h-11 bg-accent-light rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Re-upload Connections</h2>
              <p className="text-xs text-warm-400 font-medium">
                Update your network with a new LinkedIn export
              </p>
            </div>
          </div>
          <p className="text-sm text-warm-500 mb-4 leading-relaxed">
            Export your latest connections from LinkedIn and upload them here.
            New connections will be added incrementally.
          </p>
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gold-light text-gold text-xs font-semibold border border-gold/15">
            <Sparkles className="w-3.5 h-3.5" />
            Coming in Phase 2
          </div>
        </div>
      </div>
    </div>
  );
}
