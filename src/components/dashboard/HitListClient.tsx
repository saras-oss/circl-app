"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Star,
  Users,
  TrendingUp,
  MapPin,
  Briefcase,
  Building2,
  ExternalLink,
  Loader2,
  Sparkles,
  ArrowRight,
  Target,
  CheckCircle,
  Circle,
} from "lucide-react";
import Link from "next/link";
import { LINKEDIN_INDUSTRIES } from "@/lib/data/linkedin-industries";

interface HitListConnection {
  id: string;
  first_name: string;
  last_name: string;
  company: string;
  position: string;
  linkedin_url: string;
  seniority_tier: string | null;
  function_category: string | null;
  connected_on: string;
  match_score: number | null;
  match_type: string | null;
  match_reasons: string[] | null;
  suggested_approach: string | null;
  enrichment_status: string;
}

interface EnrichedProfile {
  linkedin_url: string;
  full_name: string | null;
  headline: string | null;
  current_title: string | null;
  current_company: string | null;
  current_company_linkedin: string | null;
  location_str: string | null;
  country_full_name: string | null;
  total_experience_years: number | null;
  companies_worked_at: number | null;
  profile_pic_url: string | null;
}

interface EnrichedCompany {
  linkedin_url: string;
  name: string | null;
  industry: string | null;
  hq_city: string | null;
  hq_country: string | null;
  company_size_min: number | null;
  company_size_max: number | null;
  company_type: string | null;
  latest_funding_type: string | null;
  latest_funding_amount: number | null;
}

type SortOption =
  | "score"
  | "seniority"
  | "company_size"
  | "connected_on"
  | "experience";
type MatchFilter = "all" | "customer" | "investor";
type SeniorityFilter = "all" | "C-suite" | "VP/Director" | "Manager";

const SENIORITY_ORDER: Record<string, number> = {
  "C-suite": 0,
  "VP/Director": 1,
  Manager: 2,
  IC: 3,
};

interface PipelineStatus {
  status: string;
  total: number;
  classified: number;
  enriched: number;
  scored: number;
}

export default function HitListClient({
  userId,
  processingStatus,
}: {
  userId: string;
  subscriptionTier: string;
  processingStatus: string;
}) {
  const [connections, setConnections] = useState<HitListConnection[]>([]);
  const [profiles, setProfiles] = useState<Map<string, EnrichedProfile>>(
    new Map()
  );
  const [companies, setCompanies] = useState<Map<string, EnrichedCompany>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("score");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [seniorityFilter, setSeniorityFilter] =
    useState<SeniorityFilter>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [industrySearch, setIndustrySearch] = useState("");
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);
  const [pipelineStatus, setPipelineStatus] =
    useState<PipelineStatus | null>(null);
  const [pipelineLocked, setPipelineLocked] = useState(
    processingStatus !== "completed"
  );
  const supabase = createClient();

  // Poll pipeline status when locked
  useEffect(() => {
    if (!pipelineLocked) return;

    async function checkPipeline() {
      try {
        const res = await fetch(`/api/pipeline/status?userId=${userId}`);
        if (!res.ok) return;
        const data = (await res.json()) as PipelineStatus;
        setPipelineStatus(data);
        if (data.status === "completed") {
          setPipelineLocked(false);
        }
      } catch {
        // ignore
      }
    }

    checkPipeline();
    const interval = setInterval(checkPipeline, 5000);
    return () => clearInterval(interval);
  }, [pipelineLocked, userId]);

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Fetch only score >= 7 for Hit List (1-10 scale)
    const { data: conns } = await supabase
      .from("user_connections")
      .select(
        "id, first_name, last_name, company, position, linkedin_url, seniority_tier, function_category, connected_on, match_score, match_type, match_reasons, suggested_approach, enrichment_status"
      )
      .eq("user_id", userId)
      .in("enrichment_status", ["enriched", "cached"])
      .gte("match_score", 7)
      .order("match_score", { ascending: false, nullsFirst: false });

    const connList = (conns || []) as HitListConnection[];
    setConnections(connList);

    // Fetch enriched profiles
    const linkedinUrls = connList.map((c) => c.linkedin_url).filter(Boolean);
    if (linkedinUrls.length > 0) {
      const { data: profs } = await supabase
        .from("enriched_profiles")
        .select(
          "linkedin_url, full_name, headline, current_title, current_company, current_company_linkedin, location_str, country_full_name, total_experience_years, companies_worked_at, profile_pic_url"
        )
        .in("linkedin_url", linkedinUrls);

      const profileMap = new Map(
        (profs || []).map((p) => [p.linkedin_url, p as EnrichedProfile])
      );
      setProfiles(profileMap);

      // Fetch enriched companies
      const companyUrls = (profs || [])
        .map((p) => p.current_company_linkedin)
        .filter(Boolean) as string[];
      if (companyUrls.length > 0) {
        const { data: comps } = await supabase
          .from("enriched_companies")
          .select(
            "linkedin_url, name, industry, hq_city, hq_country, company_size_min, company_size_max, company_type, latest_funding_type, latest_funding_amount"
          )
          .in("linkedin_url", companyUrls);

        setCompanies(
          new Map(
            (comps || []).map((c) => [c.linkedin_url, c as EnrichedCompany])
          )
        );
      }
    }

    setLoading(false);
  }, [supabase, userId]);

  // Fetch data when unlocked
  useEffect(() => {
    if (!pipelineLocked) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [pipelineLocked, fetchData]);

  // Build unique industry list from enriched companies
  const availableIndustries = Array.from(
    new Set(
      connections
        .map((c) => {
          const p = profiles.get(c.linkedin_url);
          const co = p?.current_company_linkedin
            ? companies.get(p.current_company_linkedin)
            : null;
          return co?.industry;
        })
        .filter(Boolean) as string[]
    )
  ).sort();

  const filteredIndustryOptions = industrySearch.trim()
    ? LINKEDIN_INDUSTRIES.filter((ind) =>
        ind.toLowerCase().includes(industrySearch.toLowerCase())
      )
    : availableIndustries;

  // Filter and sort
  const filtered = connections.filter((c) => {
    if (matchFilter !== "all" && c.match_type !== matchFilter) return false;
    if (seniorityFilter !== "all" && c.seniority_tier !== seniorityFilter)
      return false;
    if (industryFilter !== "all") {
      const p = profiles.get(c.linkedin_url);
      const co = p?.current_company_linkedin
        ? companies.get(p.current_company_linkedin)
        : null;
      if (co?.industry !== industryFilter) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "score":
        return (b.match_score || 0) - (a.match_score || 0);
      case "seniority":
        return (
          (SENIORITY_ORDER[a.seniority_tier || ""] ?? 99) -
          (SENIORITY_ORDER[b.seniority_tier || ""] ?? 99)
        );
      case "company_size": {
        const pa = profiles.get(a.linkedin_url);
        const pb = profiles.get(b.linkedin_url);
        const ca = pa?.current_company_linkedin
          ? companies.get(pa.current_company_linkedin)
          : null;
        const cb = pb?.current_company_linkedin
          ? companies.get(pb.current_company_linkedin)
          : null;
        return (cb?.company_size_min || 0) - (ca?.company_size_min || 0);
      }
      case "connected_on":
        return (b.connected_on || "").localeCompare(a.connected_on || "");
      case "experience": {
        const ea =
          profiles.get(a.linkedin_url)?.total_experience_years || 0;
        const eb =
          profiles.get(b.linkedin_url)?.total_experience_years || 0;
        return eb - ea;
      }
      default:
        return 0;
    }
  });

  function getScoreColor(score: number | null) {
    if (!score) return "bg-[#96A0B5] text-white";
    if (score >= 9) return "score-badge-excellent text-white";
    if (score >= 7) return "bg-[#0ABF53] text-white";
    if (score >= 5) return "bg-[#FFBB38] text-white";
    return "bg-[#96A0B5] text-white";
  }

  function getScoreLabel(score: number | null) {
    if (!score) return "";
    if (score >= 9) return "Excellent";
    if (score >= 7) return "Strong";
    if (score >= 5) return "Moderate";
    return "Weak";
  }

  function getSeniorityColor(tier: string | null) {
    switch (tier) {
      case "C-suite":
        return "bg-[#F3E8FF] text-[#7C3AED] border border-[#7C3AED]/20";
      case "VP/Director":
        return "bg-[#EFF6FF] text-[#2563EB] border border-[#2563EB]/20";
      case "Manager":
        return "bg-[#FFF8E6] text-[#B8860B] border border-[#FFBB38]/20";
      default:
        return "bg-[#F0F3F7] text-[#596780] border border-[#E3E8EF]";
    }
  }

  // Pipeline lock screen
  if (pipelineLocked) {
    const ps = pipelineStatus;
    const steps = [
      {
        label: "Classified connections",
        done: ps ? ps.classified >= ps.total && ps.total > 0 : false,
        active: ps ? ps.classified < ps.total && ps.total > 0 : false,
        detail: ps && ps.total > 0 ? `${ps.classified}/${ps.total}` : "",
      },
      {
        label: "Enriching profiles",
        done: ps
          ? ps.classified >= ps.total && ps.enriched > 0 && ps.status !== "classifying"
          : false,
        active: ps ? ps.status === "enriching" || (ps.classified >= ps.total && ps.enriched > 0 && ps.scored === 0) : false,
        detail: ps && ps.enriched > 0 ? `${ps.enriched} enriched` : "",
      },
      {
        label: "Scoring matches",
        done: ps ? ps.status === "completed" : false,
        active: ps ? ps.scored > 0 && ps.status !== "completed" : false,
        detail: ps && ps.scored > 0 ? `${ps.scored} scored` : "",
      },
    ];

    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#0A2540]">Hit List</h1>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-10 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 bg-[#E6F9EE] rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Target className="w-7 h-7 text-[#0ABF53]" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-bold text-[#0A2540] tracking-tight">
            Building your hit list...
          </h3>
          <p className="text-sm text-[#596780] mt-2 max-w-sm mx-auto leading-relaxed">
            We&apos;re analyzing your connections against your ICP. Your scored
            matches will appear here when ready.
          </p>

          <div className="mt-6 space-y-3 text-left max-w-xs mx-auto">
            {steps.map((step) => (
              <div key={step.label} className="flex items-center gap-3">
                {step.done ? (
                  <CheckCircle className="w-5 h-5 text-[#0ABF53] shrink-0" />
                ) : step.active ? (
                  <Loader2 className="w-5 h-5 text-[#0ABF53] shrink-0 animate-spin" />
                ) : (
                  <Circle className="w-5 h-5 text-[#96A0B5] shrink-0" />
                )}
                <span
                  className={`text-sm font-medium flex-1 ${step.done || step.active ? "text-[#0A2540]" : "text-[#96A0B5]"}`}
                >
                  {step.label}
                </span>
                {step.detail && (
                  <span className="text-xs font-semibold text-[#0ABF53] tabular-nums">
                    {step.detail}
                  </span>
                )}
              </div>
            ))}
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#0ABF53] to-[#34D399] text-white text-sm font-semibold hover:opacity-90 transition-all"
          >
            View progress on Dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#0A2540]">Hit List</h1>
          <p className="text-sm text-[#96A0B5] mt-1">
            Loading your matches...
          </p>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-6">
              <div className="h-6 w-48 rounded-lg animate-shimmer mb-3" />
              <div className="h-4 w-64 rounded-lg animate-shimmer mb-2" />
              <div className="h-4 w-96 rounded-lg animate-shimmer" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#0A2540]">Hit List</h1>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-10 text-center">
          <div className="w-16 h-16 bg-[#E6F9EE] rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Sparkles
              className="w-7 h-7 text-[#0ABF53]"
              strokeWidth={1.5}
            />
          </div>
          <h3 className="text-lg font-bold text-[#0A2540] tracking-tight">
            No strong matches found yet
          </h3>
          <p className="text-sm text-[#596780] mt-2 max-w-sm mx-auto leading-relaxed">
            Try broadening your ICP or uploading more connections. Matches
            scoring 7+ out of 10 appear here.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#0ABF53] to-[#34D399] text-white text-sm font-semibold hover:opacity-90 transition-all"
          >
            Go to Dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0A2540]">Hit List</h1>
        <p className="text-sm text-[#596780] mt-1">
          {sorted.length} high-value match
          {sorted.length !== 1 ? "es" : ""} from your network
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#96A0B5] mr-1">
          Type:
        </span>
        {(["all", "customer", "investor"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setMatchFilter(f)}
            className={`h-8 px-3.5 rounded-full text-xs font-semibold border transition-all ${
              matchFilter === f
                ? "bg-[#0A2540] text-white border-[#0A2540]"
                : "bg-white text-[#596780] border-[#E3E8EF] hover:border-[#96A0B5]"
            }`}
          >
            {f === "all"
              ? "All"
              : f === "customer"
                ? "Customers"
                : "Investors"}
          </button>
        ))}

        <span className="text-xs font-semibold uppercase tracking-wider text-[#96A0B5] ml-3 mr-1">
          Seniority:
        </span>
        {(["all", "C-suite", "VP/Director", "Manager"] as const).map(
          (f) => (
            <button
              key={f}
              onClick={() => setSeniorityFilter(f)}
              className={`h-8 px-3.5 rounded-full text-xs font-semibold border transition-all ${
                seniorityFilter === f
                  ? "bg-[#0A2540] text-white border-[#0A2540]"
                  : "bg-white text-[#596780] border-[#E3E8EF] hover:border-[#96A0B5]"
              }`}
            >
              {f === "all" ? "All" : f}
            </button>
          )
        )}
      </div>

      {/* Industry filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4 relative">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#96A0B5] mr-1">
          Industry:
        </span>
        <div className="relative">
          <button
            onClick={() => setShowIndustryDropdown(!showIndustryDropdown)}
            className={`h-8 px-3.5 rounded-full text-xs font-semibold border transition-all ${
              industryFilter !== "all"
                ? "bg-[#0A2540] text-white border-[#0A2540]"
                : "bg-white text-[#596780] border-[#E3E8EF] hover:border-[#96A0B5]"
            }`}
          >
            {industryFilter === "all" ? "All Industries" : industryFilter}
          </button>
          {showIndustryDropdown && (
            <div className="absolute top-full left-0 mt-1 w-72 max-h-64 overflow-y-auto bg-white border border-[#E3E8EF] rounded-xl shadow-lg z-50">
              <div className="sticky top-0 bg-white p-2 border-b border-[#E3E8EF]">
                <input
                  value={industrySearch}
                  onChange={(e) => setIndustrySearch(e.target.value)}
                  placeholder="Search industries..."
                  className="w-full h-8 px-3 rounded-lg border border-[#E3E8EF] bg-[#F6F8FA] text-xs focus:outline-none focus:border-[#0ABF53]"
                  autoFocus
                />
              </div>
              <button
                onClick={() => {
                  setIndustryFilter("all");
                  setShowIndustryDropdown(false);
                  setIndustrySearch("");
                }}
                className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-[#F6F8FA] transition-colors ${
                  industryFilter === "all" ? "text-[#0ABF53] font-semibold" : "text-[#0A2540]"
                }`}
              >
                All Industries
              </button>
              {filteredIndustryOptions.map((ind) => (
                <button
                  key={ind}
                  onClick={() => {
                    setIndustryFilter(ind);
                    setShowIndustryDropdown(false);
                    setIndustrySearch("");
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-[#F6F8FA] transition-colors ${
                    industryFilter === ind ? "text-[#0ABF53] font-semibold" : "text-[#0A2540]"
                  }`}
                >
                  {ind}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#96A0B5]">
          Sort:
        </span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="h-8 px-3 rounded-lg border border-[#E3E8EF] bg-white text-xs font-medium text-[#0A2540]"
        >
          <option value="score">Match Score</option>
          <option value="seniority">Seniority</option>
          <option value="company_size">Company Size</option>
          <option value="connected_on">Connected Date</option>
          <option value="experience">Experience</option>
        </select>
      </div>

      {/* Person Cards */}
      <div className="space-y-5 max-w-[720px] mx-auto">
        {sorted.map((conn) => {
          const profile = profiles.get(conn.linkedin_url);
          const company = profile?.current_company_linkedin
            ? companies.get(profile.current_company_linkedin)
            : null;
          const initials =
            `${(conn.first_name || "?")[0]}${(conn.last_name || "?")[0]}`.toUpperCase();

          return (
            <div
              key={conn.id}
              className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-6 hover:shadow-md transition-shadow"
            >
              {/* Top section: Avatar + Name + Score */}
              <div className="flex items-start gap-4 mb-4">
                {/* Avatar */}
                {profile?.profile_pic_url ? (
                  <img
                    src={profile.profile_pic_url}
                    alt=""
                    className="w-14 h-14 rounded-2xl object-cover shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0ABF53] to-[#34D399] flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm">
                      {initials}
                    </span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-base text-[#0A2540]">
                        {profile?.full_name ||
                          `${conn.first_name} ${conn.last_name}`}
                      </h3>
                      <p className="text-sm text-[#596780] mt-0.5">
                        {profile?.current_title || conn.position}
                        {(profile?.current_company || conn.company) && (
                          <>
                            {" "}
                            at{" "}
                            <span className="font-medium text-[#0A2540]">
                              {profile?.current_company || conn.company}
                            </span>
                          </>
                        )}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-[#96A0B5]">
                        {(profile?.location_str ||
                          profile?.country_full_name) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {profile.location_str ||
                              profile.country_full_name}
                          </span>
                        )}
                        {profile?.total_experience_years && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3 h-3" />
                            {profile.total_experience_years} yrs exp
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Score badge */}
                    <div
                      className={`shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center ${getScoreColor(conn.match_score)}`}
                      style={
                        conn.match_score != null && conn.match_score >= 9
                          ? { background: "linear-gradient(135deg, #0ABF53, #34D399)" }
                          : undefined
                      }
                    >
                      {conn.match_score != null ? (
                        <>
                          <span className="text-lg font-bold leading-none">
                            {conn.match_score}
                          </span>
                          <span className="text-[8px] font-semibold uppercase opacity-80">
                            {getScoreLabel(conn.match_score)}
                          </span>
                        </>
                      ) : (
                        <Loader2 className="w-5 h-5 animate-spin opacity-60" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {conn.match_type && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      conn.match_type === "customer"
                        ? "bg-[#E6F9EE] text-[#089E45] border border-[#0ABF53]/15"
                        : "bg-purple-50 text-purple-700 border border-purple-200/15"
                    }`}
                  >
                    {conn.match_type === "customer" ? (
                      <Users className="w-3 h-3" />
                    ) : (
                      <TrendingUp className="w-3 h-3" />
                    )}
                    {conn.match_type === "customer"
                      ? "Customer"
                      : "Investor"}
                  </span>
                )}
                {conn.seniority_tier && (
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getSeniorityColor(conn.seniority_tier)}`}
                  >
                    {conn.seniority_tier}
                  </span>
                )}
              </div>

              {/* Company section */}
              {company && (
                <div className="bg-[#F6F8FA] rounded-xl p-3.5 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-3.5 h-3.5 text-[#96A0B5]" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#96A0B5]">
                      Company
                    </span>
                  </div>
                  <p className="text-sm font-medium text-[#0A2540]">
                    {company.name || conn.company}
                    {company.industry && (
                      <span className="text-[#596780]">
                        {" "}
                        &middot; {company.industry}
                      </span>
                    )}
                    {company.hq_city && (
                      <span className="text-[#596780]">
                        {" "}
                        &middot; {company.hq_city}
                        {company.hq_country
                          ? `, ${company.hq_country}`
                          : ""}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#596780] mt-1">
                    {company.company_size_min && (
                      <span>
                        {company.company_size_min.toLocaleString()}+ employees
                      </span>
                    )}
                    {company.company_type && (
                      <span>{company.company_type}</span>
                    )}
                    {company.latest_funding_type && (
                      <span className="text-[#0ABF53] font-medium">
                        {company.latest_funding_type}
                        {company.latest_funding_amount
                          ? ` ($${(company.latest_funding_amount / 1_000_000).toFixed(0)}M)`
                          : ""}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Match reasons */}
              {conn.match_reasons && conn.match_reasons.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-3.5 h-3.5 text-[#0ABF53]" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#96A0B5]">
                      Why this match
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {conn.match_reasons.map((reason, i) => (
                      <li
                        key={i}
                        className="text-[13px] text-[#596780] leading-relaxed flex gap-2"
                      >
                        <span className="text-[#0ABF53] shrink-0 mt-1">
                          &bull;
                        </span>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggested approach */}
              {conn.suggested_approach && (
                <p className="text-[13px] text-[#596780] italic mb-4 pl-3 border-l-2 border-[#0ABF53]/20">
                  {conn.suggested_approach}
                </p>
              )}

              {/* Footer: Connected date + CTA */}
              <div className="flex items-center justify-between pt-3 border-t border-[#F0F3F7]">
                <span className="text-xs text-[#96A0B5]">
                  Connected {conn.connected_on || "\u2014"}
                </span>
                {conn.linkedin_url && (
                  <a
                    href={conn.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-gradient-to-r from-[#0ABF53] to-[#34D399] text-white text-xs font-semibold hover:opacity-90 transition-all"
                  >
                    Reach out on LinkedIn
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
