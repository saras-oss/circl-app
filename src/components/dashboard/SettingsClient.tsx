"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { User, CreditCard, Target, Upload } from "lucide-react";

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
    starter: "Starter — $100/year",
    growth: "Growth — $300/year",
    scale: "Scale — $500/year",
    enterprise: "Enterprise — $700/year",
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="space-y-6">
        {/* Profile */}
        <div className="bg-white rounded-2xl border p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold">Profile</h2>
              <p className="text-xs text-muted-foreground">
                Your personal and company details
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                LinkedIn URL
              </label>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Role / Title
                </label>
                <input
                  type="text"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Company Website
              </label>
              <input
                type="url"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="h-12 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
            </button>
          </form>
        </div>

        {/* Subscription */}
        <div className="bg-white rounded-2xl border p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold">Subscription</h2>
              <p className="text-xs text-muted-foreground">
                Your plan and billing details
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Plan</span>
              <span className="text-sm font-medium">
                {tierLabels[profile.subscription_tier as string] || "None"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <span
                className={`text-sm font-medium ${profile.subscription_status === "active" ? "text-green" : "text-muted-foreground"}`}
              >
                {profile.subscription_status === "active"
                  ? "Active"
                  : "Inactive"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">
                Connections Analyzed
              </span>
              <span className="text-sm font-medium">
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
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">
                  Last Payment
                </span>
                <span className="text-sm font-medium">
                  ${((payment.amount as number) / 100).toFixed(0)} on{" "}
                  {new Date(payment.created_at as string).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {profile.subscription_tier === "free" && (
            <div className="mt-4 p-4 rounded-xl bg-muted">
              <p className="text-sm font-medium">Upgrade your plan</p>
              <p className="text-xs text-muted-foreground mt-1">
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
        <div className="bg-white rounded-2xl border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold">Ideal Customer Profile</h2>
              <p className="text-xs text-muted-foreground">
                Your targeting criteria for matches
              </p>
            </div>
          </div>
          {profile.icp_data &&
          Object.keys(profile.icp_data as object).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(profile.icp_data as Record<string, unknown>).map(
                ([key, value]) => {
                  if (typeof value === "boolean" || !value) return null;
                  const label = key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (s) => s.toUpperCase());
                  return (
                    <div key={key}>
                      <p className="text-xs text-muted-foreground mb-1">
                        {label}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.isArray(value) ? (
                          value.map((v: string) => (
                            <span
                              key={v}
                              className="text-xs px-2.5 py-1 rounded-full bg-muted text-foreground"
                            >
                              {v}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-foreground">
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
            <p className="text-sm text-muted-foreground">No ICP defined yet</p>
          )}
        </div>

        {/* Re-upload CSV */}
        <div className="bg-white rounded-2xl border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold">Re-upload Connections</h2>
              <p className="text-xs text-muted-foreground">
                Update your network with a new LinkedIn export
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Export your latest connections from LinkedIn and upload them here.
            New connections will be added incrementally.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-xs font-medium text-muted-foreground">
            Coming in Phase 2
          </div>
        </div>
      </div>
    </div>
  );
}
