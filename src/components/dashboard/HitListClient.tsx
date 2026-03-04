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
} from "lucide-react";
import Link from "next/link";

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

type SortOption = "score" | "seniority" | "company_size" | "connected_on" | "experience";
type MatchFilter = "all" | "customer" | "investor";
type SeniorityFilter = "all" | "C-suite" | "VP/Director" | "Manager";

const SENIORITY_ORDER: Record<string, number> = {
  "C-suite": 0,
  "VP/Director": 1,
  "Manager": 2,
  "IC": 3,
};

export default function HitListClient({
  userId,
  processingStatus,
}: {
  userId: string;
  subscriptionTier: string;
  processingStatus: string;
}) {
  const [connections, setConnections] = useState<HitListConnection[]>([]);
  const [profiles, setProfiles] = useState<Map<string, EnrichedProfile>>(new Map());
  const [companies, setCompanies] = useState<Map<string, EnrichedCompany>>(new Map());
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("score");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [seniorityFilter, setSeniorityFilter] = useState<SeniorityFilter>("all");
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Fetch tier1+tier2 enriched connections
    const { data: conns } = await supabase
      .from("user_connections")
      .select("id, first_name, last_name, company, position, linkedin_url, seniority_tier, function_category, connected_on, match_score, match_type, match_reasons, suggested_approach, enrichment_status")
      .eq("user_id", userId)
      .in("enrichment_status", ["enriched", "cached"])
      .in("enrichment_tier", ["tier1", "tier2"])
      .order("match_score", { ascending: false, nullsFirst: false });

    const connList = (conns || []) as HitListConnection[];
    setConnections(connList);

    // Fetch enriched profiles
    const linkedinUrls = connList.map((c) => c.linkedin_url).filter(Boolean);
    if (linkedinUrls.length > 0) {
      const { data: profs } = await supabase
        .from("enriched_profiles")
        .select("linkedin_url, full_name, headline, current_title, current_company, current_company_linkedin, location_str, country_full_name, total_experience_years, companies_worked_at, profile_pic_url")
        .in("linkedin_url", linkedinUrls);

      const profileMap = new Map((profs || []).map((p) => [p.linkedin_url, p as EnrichedProfile]));
      setProfiles(profileMap);

      // Fetch enriched companies
      const companyUrls = (profs || []).map((p) => p.current_company_linkedin).filter(Boolean) as string[];
      if (companyUrls.length > 0) {
        const { data: comps } = await supabase
          .from("enriched_companies")
          .select("linkedin_url, name, industry, hq_city, hq_country, company_size_min, company_size_max, company_type, latest_funding_type, latest_funding_amount")
          .in("linkedin_url", companyUrls);

        setCompanies(new Map((comps || []).map((c) => [c.linkedin_url, c as EnrichedCompany])));
      }
    }

    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter and sort
  const filtered = connections.filter((c) => {
    if (matchFilter !== "all" && c.match_type !== matchFilter) return false;
    if (seniorityFilter !== "all" && c.seniority_tier !== seniorityFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "score":
        return (b.match_score || 0) - (a.match_score || 0);
      case "seniority":
        return (SENIORITY_ORDER[a.seniority_tier || ""] ?? 99) - (SENIORITY_ORDER[b.seniority_tier || ""] ?? 99);
      case "company_size": {
        const pa = profiles.get(a.linkedin_url);
        const pb = profiles.get(b.linkedin_url);
        const ca = pa?.current_company_linkedin ? companies.get(pa.current_company_linkedin) : null;
        const cb = pb?.current_company_linkedin ? companies.get(pb.current_company_linkedin) : null;
        return (cb?.company_size_min || 0) - (ca?.company_size_min || 0);
      }
      case "connected_on":
        return (b.connected_on || "").localeCompare(a.connected_on || "");
      case "experience": {
        const ea = profiles.get(a.linkedin_url)?.total_experience_years || 0;
        const eb = profiles.get(b.linkedin_url)?.total_experience_years || 0;
        return eb - ea;
      }
      default:
        return 0;
    }
  });

  function getScoreColor(score: number | null) {
    if (!score) return "bg-warm-100 text-warm-500";
    if (score >= 85) return "bg-[#1B4332] text-white";
    if (score >= 70) return "bg-[#2D6A4F] text-white";
    if (score >= 50) return "bg-amber-500 text-white";
    return "bg-warm-200 text-warm-600";
  }

  function getSeniorityColor(tier: string | null) {
    switch (tier) {
      case "C-suite": return "bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800 border border-amber-200/60";
      case "VP/Director": return "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 border border-blue-200/60";
      case "Manager": return "bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-800 border border-emerald-200/60";
      default: return "bg-warm-100 text-warm-600 border border-warm-200/60";
    }
  }

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Hit List</h1>
          <p className="text-sm text-warm-400 mt-1">Loading your matches...</p>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card-elevated p-6">
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
          <h1 className="text-2xl font-bold tracking-tight">Hit List</h1>
        </div>
        <div className="card-elevated p-10 text-center">
          <div className="w-16 h-16 bg-accent-light rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Sparkles className="w-7 h-7 text-accent" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-bold tracking-tight">
            {processingStatus === "completed"
              ? "No enriched connections yet"
              : "Your hit list is being prepared"}
          </h3>
          <p className="text-sm text-warm-500 mt-2 max-w-sm mx-auto leading-relaxed">
            {processingStatus === "completed"
              ? "Your connections need to be enriched before scoring. Check your dashboard for pipeline status."
              : "Matches will appear here once the pipeline finishes classifying, enriching, and scoring."}
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-all"
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
        <h1 className="text-2xl font-bold tracking-tight">Hit List</h1>
        <p className="text-sm text-warm-400 mt-1">
          {sorted.length} high-value connections from your network
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-warm-400 mr-1">Type:</span>
        {(["all", "customer", "investor"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setMatchFilter(f)}
            className={`h-8 px-3.5 rounded-full text-xs font-semibold border transition-all ${
              matchFilter === f
                ? "bg-[#1B4332] text-white border-[#1B4332]"
                : "bg-surface text-warm-500 border-border hover:border-border-strong"
            }`}
          >
            {f === "all" ? "All" : f === "customer" ? "Customers" : "Investors"}
          </button>
        ))}

        <span className="text-xs font-semibold uppercase tracking-wider text-warm-400 ml-3 mr-1">Seniority:</span>
        {(["all", "C-suite", "VP/Director", "Manager"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setSeniorityFilter(f)}
            className={`h-8 px-3.5 rounded-full text-xs font-semibold border transition-all ${
              seniorityFilter === f
                ? "bg-[#1B4332] text-white border-[#1B4332]"
                : "bg-surface text-warm-500 border-border hover:border-border-strong"
            }`}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-warm-400">Sort:</span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="h-8 px-3 rounded-lg border border-border bg-surface text-xs font-medium text-foreground"
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
          const initials = `${(conn.first_name || "?")[0]}${(conn.last_name || "?")[0]}`.toUpperCase();

          return (
            <div key={conn.id} className="card-elevated p-6 hover:shadow-md transition-shadow">
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
                  <div className="w-14 h-14 rounded-2xl bg-[#1B4332] flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm">{initials}</span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-base text-foreground">
                        {profile?.full_name || `${conn.first_name} ${conn.last_name}`}
                      </h3>
                      <p className="text-sm text-warm-500 mt-0.5">
                        {profile?.current_title || conn.position}
                        {(profile?.current_company || conn.company) && (
                          <> at <span className="font-medium text-foreground">{profile?.current_company || conn.company}</span></>
                        )}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-warm-400">
                        {(profile?.location_str || profile?.country_full_name) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {profile.location_str || profile.country_full_name}
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
                    <div className={`shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center ${getScoreColor(conn.match_score)}`}>
                      {conn.match_score != null ? (
                        <>
                          <span className="text-lg font-bold leading-none">{conn.match_score}</span>
                          <span className="text-[9px] font-semibold uppercase opacity-80">Score</span>
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
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    conn.match_type === "customer"
                      ? "bg-accent-light text-accent border border-accent/15"
                      : "bg-purple-light text-purple border border-purple/15"
                  }`}>
                    {conn.match_type === "customer" ? (
                      <Users className="w-3 h-3" />
                    ) : (
                      <TrendingUp className="w-3 h-3" />
                    )}
                    {conn.match_type === "customer" ? "Customer" : "Investor"}
                  </span>
                )}
                {conn.seniority_tier && (
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getSeniorityColor(conn.seniority_tier)}`}>
                    {conn.seniority_tier}
                  </span>
                )}
              </div>

              {/* Company section */}
              {company && (
                <div className="bg-warm-50 rounded-xl p-3.5 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-3.5 h-3.5 text-warm-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-warm-400">Company</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {company.name || conn.company}
                    {company.industry && <span className="text-warm-500"> &middot; {company.industry}</span>}
                    {company.hq_city && <span className="text-warm-500"> &middot; {company.hq_city}{company.hq_country ? `, ${company.hq_country}` : ""}</span>}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-warm-500 mt-1">
                    {company.company_size_min && (
                      <span>{company.company_size_min.toLocaleString()}+ employees</span>
                    )}
                    {company.company_type && <span>{company.company_type}</span>}
                    {company.latest_funding_type && (
                      <span className="text-accent font-medium">
                        {company.latest_funding_type}
                        {company.latest_funding_amount ? ` ($${(company.latest_funding_amount / 1_000_000).toFixed(0)}M)` : ""}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Match reasons */}
              {conn.match_reasons && conn.match_reasons.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-3.5 h-3.5 text-accent" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-warm-400">Why this match</span>
                  </div>
                  <ul className="space-y-1.5">
                    {conn.match_reasons.map((reason, i) => (
                      <li key={i} className="text-[13px] text-warm-600 leading-relaxed flex gap-2">
                        <span className="text-accent shrink-0 mt-1">&bull;</span>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggested approach */}
              {conn.suggested_approach && (
                <p className="text-[13px] text-warm-500 italic mb-4 pl-3 border-l-2 border-accent/20">
                  {conn.suggested_approach}
                </p>
              )}

              {/* Footer: Connected date + CTA */}
              <div className="flex items-center justify-between pt-3 border-t border-border/60">
                <span className="text-xs text-warm-400">
                  Connected {conn.connected_on || "\u2014"}
                </span>
                {conn.linkedin_url && (
                  <a
                    href={conn.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#1B4332]/90 transition-all"
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
