"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  User,
  CreditCard,
  Target,
  Upload,
  Check,
  Sparkles,
  BarChart3,
  X,
  Plus,
  Pencil,
} from "lucide-react";

interface SettingsClientProps {
  userId: string;
  profile: Record<string, unknown>;
  payment: Record<string, unknown> | null;
}

interface IcpFields {
  industries: string[];
  titles: string[];
  companySizes: string[];
  geographies: string[];
  fundingStages: string[];
  triggers: string[];
}

const ICP_FIELD_LABELS: Record<keyof IcpFields, string> = {
  industries: "Target Industries",
  titles: "Target Titles",
  companySizes: "Company Sizes",
  geographies: "Geographies",
  fundingStages: "Funding Stages",
  triggers: "Sales Triggers",
};

function TagEditor({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) {
        onChange([...tags, input.trim()]);
      }
      setInput("");
    }
    if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function removeTag(index: number) {
    onChange(tags.filter((_, i) => i !== index));
  }

  return (
    <div className="min-h-[52px] px-3 py-2 bg-white border border-[#E3E8EF] rounded-lg flex flex-wrap gap-2 items-center transition-all focus-within:border-[#0ABF53] focus-within:ring-2 focus-within:ring-[#0ABF53]/20">
      {tags.map((tag, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#E6F9EE] text-[#089E45] border border-[#0ABF53]/20"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(i)}
            className="hover:text-[#089E45]/70 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : "Add more..."}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-[#0A2540] placeholder:text-[#96A0B5] outline-none py-1"
      />
    </div>
  );
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

  // ICP state
  const rawIcp = profile.icp_data as Record<string, unknown> | null;
  const [icpEditing, setIcpEditing] = useState(false);
  const [icpFields, setIcpFields] = useState<IcpFields>({
    industries: (rawIcp?.industries as string[]) || [],
    titles: (rawIcp?.titles as string[]) || [],
    companySizes: (rawIcp?.companySizes as string[]) || [],
    geographies: (rawIcp?.geographies as string[]) || [],
    fundingStages: (rawIcp?.fundingStages as string[]) || [],
    triggers: (rawIcp?.triggers as string[]) || [],
  });
  const [icpSaving, setIcpSaving] = useState(false);
  const [icpSaved, setIcpSaved] = useState(false);

  // Usage stats
  const [usageStats, setUsageStats] = useState<{
    uploaded: number;
    enriched: number;
    scored: number;
  } | null>(null);

  const icpRef = useRef<HTMLDivElement>(null);

  // Scroll to hash on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        const el = document.querySelector(hash);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, []);

  // Load usage stats
  useEffect(() => {
    async function loadUsage() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { count: total } = await supabase
        .from("user_connections")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { count: enriched } = await supabase
        .from("user_connections")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("enrichment_status", ["enriched", "cached"]);

      const { count: scored } = await supabase
        .from("user_connections")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("match_score", "is", null);

      setUsageStats({
        uploaded: total || 0,
        enriched: enriched || 0,
        scored: scored || 0,
      });
    }
    loadUsage();
  }, [supabase]);

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

  async function handleSaveIcp() {
    setIcpSaving(true);
    setIcpSaved(false);

    const icpData = {
      ...rawIcp,
      ...icpFields,
    };

    const res = await fetch("/api/icp/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, icpData }),
    });

    setIcpSaving(false);
    if (res.ok) {
      setIcpSaved(true);
      setIcpEditing(false);
      setTimeout(() => setIcpSaved(false), 3000);
    }
  }

  function updateIcpField(field: keyof IcpFields, value: string[]) {
    setIcpFields((prev) => ({ ...prev, [field]: value }));
  }

  const tierLabels: Record<string, string> = {
    free: "Free",
    starter: "Starter \u2014 $100/year",
    growth: "Growth \u2014 $300/year",
    scale: "Scale \u2014 $500/year",
    enterprise: "Enterprise \u2014 $700/year",
  };

  const inputClasses =
    "w-full h-[52px] px-4 py-2.5 bg-white border border-[#E3E8EF] rounded-lg text-sm font-medium text-[#0A2540] placeholder:text-[#96A0B5] focus:border-[#0ABF53] focus:ring-2 focus:ring-[#0ABF53]/20 outline-none transition-all";

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[#0A2540]">
          Settings
        </h1>
      </div>

      <div className="space-y-6 stagger-children">
        {/* Profile */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-6 sm:p-8">
          <div className="flex items-center gap-3.5 mb-8">
            <div className="w-11 h-11 bg-[#E6F9EE] rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-[#0ABF53]" />
            </div>
            <div>
              <h2 className="font-semibold text-[#0A2540]">Profile</h2>
              <p className="text-xs text-[#96A0B5] font-medium">
                Your personal and company details
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div>
              <label className="text-xs font-medium text-[#596780] uppercase tracking-wide mb-3 block">
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
              <label className="text-xs font-medium text-[#596780] uppercase tracking-wide mb-3 block">
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
                <label className="text-xs font-medium text-[#596780] uppercase tracking-wide mb-3 block">
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
                <label className="text-xs font-medium text-[#596780] uppercase tracking-wide mb-3 block">
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
              <label className="text-xs font-medium text-[#596780] uppercase tracking-wide mb-3 block">
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
              className="h-[52px] px-8 rounded-lg bg-gradient-to-r from-[#0ABF53] to-[#34D399] text-white text-sm font-semibold hover:opacity-90 transition-all duration-150 disabled:opacity-50 active:scale-[0.98] flex items-center gap-2 min-w-[140px] justify-center"
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

        {/* ICP */}
        <div id="icp" ref={icpRef} className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-6 sm:p-8 scroll-mt-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 bg-[#E6F9EE] rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-[#0ABF53]" />
              </div>
              <div>
                <h2 className="font-semibold text-[#0A2540]">
                  Ideal Customer Profile
                </h2>
                <p className="text-xs text-[#96A0B5] font-medium">
                  Your targeting criteria for matches
                </p>
              </div>
            </div>
            {!icpEditing &&
              rawIcp &&
              Object.keys(rawIcp).length > 0 && (
                <button
                  onClick={() => setIcpEditing(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#0ABF53] hover:text-[#0ABF53]/80 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
          </div>

          {icpEditing ? (
            <div className="space-y-5">
              {(Object.keys(ICP_FIELD_LABELS) as (keyof IcpFields)[]).map(
                (field) => (
                  <div key={field}>
                    <label className="text-xs font-medium text-[#596780] uppercase tracking-wide mb-3 block">
                      {ICP_FIELD_LABELS[field]}
                    </label>
                    <TagEditor
                      tags={icpFields[field]}
                      onChange={(tags) => updateIcpField(field, tags)}
                      placeholder={`Add ${ICP_FIELD_LABELS[field].toLowerCase()}...`}
                    />
                  </div>
                )
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveIcp}
                  disabled={icpSaving}
                  className="h-[44px] px-6 rounded-lg bg-gradient-to-r from-[#0ABF53] to-[#34D399] text-white text-sm font-semibold hover:opacity-90 transition-all duration-150 disabled:opacity-50 active:scale-[0.98] flex items-center gap-2"
                >
                  {icpSaving ? (
                    "Saving..."
                  ) : icpSaved ? (
                    <>
                      <Check className="w-4 h-4" />
                      Saved!
                    </>
                  ) : (
                    "Save ICP"
                  )}
                </button>
                <button
                  onClick={() => {
                    setIcpEditing(false);
                    setIcpFields({
                      industries: (rawIcp?.industries as string[]) || [],
                      titles: (rawIcp?.titles as string[]) || [],
                      companySizes: (rawIcp?.companySizes as string[]) || [],
                      geographies: (rawIcp?.geographies as string[]) || [],
                      fundingStages: (rawIcp?.fundingStages as string[]) || [],
                      triggers: (rawIcp?.triggers as string[]) || [],
                    });
                  }}
                  className="h-[44px] px-6 rounded-lg border border-[#E3E8EF] text-sm font-semibold text-[#596780] hover:text-[#0A2540] hover:border-[#596780] transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : rawIcp && Object.keys(rawIcp).length > 0 ? (
            <div className="space-y-5">
              {Object.entries(rawIcp).map(([key, value]) => {
                if (typeof value === "boolean" || !value) return null;
                const label = key
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (s) => s.toUpperCase());
                return (
                  <div key={key}>
                    <p className="text-xs font-medium text-[#596780] uppercase tracking-wide mb-3">
                      {label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(value) ? (
                        value.map((v: string) => (
                          <span
                            key={v}
                            className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-[#E6F9EE] text-[#089E45] border border-[#0ABF53]/20"
                          >
                            {v}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-[#E6F9EE] text-[#089E45] border border-[#0ABF53]/20">
                          {String(value)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm text-[#96A0B5] font-medium mb-3">
                No ICP defined yet
              </p>
              <button
                onClick={() => setIcpEditing(true)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0ABF53] hover:text-[#0ABF53]/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Define your ICP
              </button>
            </div>
          )}
        </div>

        {/* Subscription & Billing */}
        <div id="billing" className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-6 sm:p-8 scroll-mt-6">
          <div className="flex items-center gap-3.5 mb-8">
            <div className="w-11 h-11 bg-[#E6F9EE] rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-[#0ABF53]" />
            </div>
            <div>
              <h2 className="font-semibold text-[#0A2540]">Subscription</h2>
              <p className="text-xs text-[#96A0B5] font-medium">
                Your plan and billing details
              </p>
            </div>
          </div>

          <div className="space-y-0 divide-y divide-[#E3E8EF]/60">
            <div className="flex items-center justify-between py-4 first:pt-0">
              <span className="text-sm text-[#596780] font-medium">Plan</span>
              <span className="text-sm font-semibold text-[#0A2540]">
                {tierLabels[profile.subscription_tier as string] || "None"}
              </span>
            </div>
            <div className="flex items-center justify-between py-4">
              <span className="text-sm text-[#596780] font-medium">Status</span>
              <span
                className={`text-sm font-semibold ${profile.subscription_status === "active" ? "text-[#0ABF53]" : "text-[#96A0B5]"}`}
              >
                {profile.subscription_status === "active"
                  ? "Active"
                  : "Inactive"}
              </span>
            </div>
            <div className="flex items-center justify-between py-4">
              <span className="text-sm text-[#596780] font-medium">
                Connections Analyzed
              </span>
              <span className="text-sm font-semibold text-[#0A2540]">
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
                <span className="text-sm text-[#596780] font-medium">
                  Last Payment
                </span>
                <span className="text-sm font-semibold text-[#0A2540]">
                  ${((payment.amount as number) / 100).toFixed(0)} on{" "}
                  {new Date(
                    payment.created_at as string
                  ).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {profile.subscription_tier === "free" && (
            <div className="mt-6 p-5 rounded-2xl bg-[#E6F9EE] border border-[#0ABF53]/10">
              <p className="text-sm font-semibold text-[#0A2540]">
                Upgrade your plan
              </p>
              <p className="text-xs text-[#596780] mt-1 leading-relaxed">
                Analyze all{" "}
                {(
                  (profile.total_connections as number) || 0
                ).toLocaleString()}{" "}
                connections in your network
              </p>
            </div>
          )}
        </div>

        {/* Usage & Limits */}
        <div id="usage" className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-6 sm:p-8 scroll-mt-6">
          <div className="flex items-center gap-3.5 mb-8">
            <div className="w-11 h-11 bg-[#E6F9EE] rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-[#0ABF53]" />
            </div>
            <div>
              <h2 className="font-semibold text-[#0A2540]">Usage & Limits</h2>
              <p className="text-xs text-[#96A0B5] font-medium">
                Your pipeline usage
              </p>
            </div>
          </div>

          {usageStats ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-xl bg-[#F6F8FA] border border-[#E3E8EF]">
                <p className="text-2xl font-bold text-[#0A2540]">
                  {usageStats.uploaded.toLocaleString()}
                </p>
                <p className="text-xs text-[#96A0B5] font-medium mt-1">
                  Uploaded
                </p>
              </div>
              <div className="text-center p-4 rounded-xl bg-[#F6F8FA] border border-[#E3E8EF]">
                <p className="text-2xl font-bold text-[#0A2540]">
                  {usageStats.enriched.toLocaleString()}
                </p>
                <p className="text-xs text-[#96A0B5] font-medium mt-1">
                  Enriched
                </p>
              </div>
              <div className="text-center p-4 rounded-xl bg-[#F6F8FA] border border-[#E3E8EF]">
                <p className="text-2xl font-bold text-[#0A2540]">
                  {usageStats.scored.toLocaleString()}
                </p>
                <p className="text-xs text-[#96A0B5] font-medium mt-1">
                  Scored
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E3E8EF] border-t-[#0ABF53]" />
            </div>
          )}
        </div>

        {/* Re-upload CSV */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-6 sm:p-8">
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-11 h-11 bg-[#E6F9EE] rounded-lg flex items-center justify-center">
              <Upload className="w-5 h-5 text-[#0ABF53]" />
            </div>
            <div>
              <h2 className="font-semibold text-[#0A2540]">
                Re-upload Connections
              </h2>
              <p className="text-xs text-[#96A0B5] font-medium">
                Update your network with a new LinkedIn export
              </p>
            </div>
          </div>
          <p className="text-sm text-[#596780] mb-4 leading-relaxed">
            Export your latest connections from LinkedIn and upload them here.
            New connections will be added incrementally.
          </p>
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FFF8E6] text-[#B8860B] text-xs font-semibold border border-[#FFBB38]/20">
            <Sparkles className="w-3.5 h-3.5 text-[#FFBB38]" />
            Coming in Phase 2
          </div>
        </div>
      </div>
    </div>
  );
}
