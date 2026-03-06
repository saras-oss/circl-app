"use client";

import { useState, useEffect, useRef, useCallback, useMemo, FormEvent } from "react";
import { useRouter } from "next/navigation";
import PipelineProgress from "./PipelineProgress";
import UpgradeBanner from "./UpgradeBanner";
import { usePipelineOrchestrator } from "@/hooks/usePipelineOrchestrator";
import { createClient } from "@/lib/supabase/client";
import {
  Search,
  Target,
  Building2,
  TrendingUp,
  MapPin,
  Users,
  Factory,
  Calendar,
  ArrowRight,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import NetworkSpotlight from "./NetworkSpotlight";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";

// --- Types ---

interface NetworkConnection {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  company_industry: string | null;
  company_size_min: number | null;
  company_size_max: number | null;
  latest_funding_type: string | null;
  latest_funding_amount: number | null;
  latest_funding_date: string | null;
  total_funding_amount: number | null;
  company_website: string | null;
  company_logo_url: string | null;
  company_type: string | null;
  hq_city: string | null;
  hq_country: string | null;
  seniority_tier: string | null;
  match_score: number | null;
  match_type: string | null;
  current_title: string | null;
  profile_pic_url: string | null;
  linkedin_url: string | null;
  connected_on: string | null;
  country_full_name: string | null;
}

interface FundingSignal {
  company: string;
  fundingType: string;
  fundingAmount: number | null;
  totalFunding: number | null;
  fundingDate: string | null;
  contacts: { name: string; title: string | null; score: number | null }[];
  totalContacts: number;
}

interface DashboardClientProps {
  userId: string;
  profile: Record<string, unknown>;
  subscriptionTier: string;
  processingStatus: string;
}

// --- Helpers ---

const SENIORITY_COLORS = ["#0ABF53", "#2DD375", "#76E5AA", "#BEF7DD", "#E5E7EB"];
const PRIMARY_GREEN = "#0ABF53";

function formatFunding(amount: number): string {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(month) - 1]} ${year.slice(2)}`;
}

// --- Skeleton components ---

function SkeletonBox({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-[#F0F3F7] rounded-xl ${className}`} />;
}

// --- Tooltip style ---
const tooltipStyle = {
  borderRadius: "8px",
  fontSize: "12px",
  border: "1px solid #E3E8EF",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

// --- Main component ---

export default function DashboardClient({
  userId,
  profile,
  subscriptionTier,
  processingStatus,
}: DashboardClientProps) {
  const router = useRouter();
  const [connections, setConnections] = useState<NetworkConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const pipelineState = usePipelineOrchestrator(userId, processingStatus);
  const hasRefreshedRef = useRef(false);

  // Fetch all connections from network_view
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("network_view")
        .select(
          "first_name, last_name, company_name, company_industry, company_size_min, company_size_max, latest_funding_type, latest_funding_amount, latest_funding_date, total_funding_amount, company_website, company_logo_url, company_type, hq_city, hq_country, seniority_tier, match_score, match_type, current_title, profile_pic_url, linkedin_url, connected_on, country_full_name"
        )
        .eq("user_id", userId);

      setConnections(data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (processingStatus === "completed") {
      fetchData();
    }
  }, [processingStatus, fetchData]);

  useEffect(() => {
    if (
      pipelineState.step === "completed" &&
      processingStatus !== "completed" &&
      !hasRefreshedRef.current
    ) {
      hasRefreshedRef.current = true;
      const timer = setTimeout(() => {
        router.refresh();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [pipelineState.step, processingStatus, router]);

  // --- Computed data ---

  const hitListMatches = useMemo(() => {
    const hits = connections.filter((c) => (c.match_score ?? 0) >= 7);
    const byType = new Map<string, number>();
    for (const h of hits) {
      const type = h.match_type || "other";
      byType.set(type, (byType.get(type) || 0) + 1);
    }
    return { total: hits.length, byType };
  }, [connections]);

  const icpFitCompanies = useMemo(() => {
    const hits = connections.filter((c) => (c.match_score ?? 0) >= 7 && c.company_name);
    const companies = new Set(hits.map((c) => c.company_name!));
    const industries = new Set(hits.map((c) => c.company_industry).filter(Boolean));
    return { total: companies.size, industries: industries.size };
  }, [connections]);

  const recentlyFunded = useMemo(() => {
    const funded = connections.filter((c) => c.latest_funding_type && c.company_name);
    const companies = new Set(funded.map((c) => c.company_name!));
    return { total: companies.size };
  }, [connections]);

  const fundingSignals = useMemo((): FundingSignal[] => {
    const funded = connections.filter((c) => c.latest_funding_type && c.company_name);
    const grouped = new Map<string, NetworkConnection[]>();
    for (const c of funded) {
      const existing = grouped.get(c.company_name!) || [];
      existing.push(c);
      grouped.set(c.company_name!, existing);
    }

    const signals: FundingSignal[] = [];
    for (const [company, conns] of grouped) {
      const sample = conns[0];
      const sorted = [...conns].sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0));
      signals.push({
        company,
        fundingType: sample.latest_funding_type!,
        fundingAmount: sample.latest_funding_amount,
        totalFunding: sample.total_funding_amount,
        fundingDate: sample.latest_funding_date,
        contacts: sorted.slice(0, 3).map((c) => ({
          name: [c.first_name, c.last_name].filter(Boolean).join(" "),
          title: c.current_title,
          score: c.match_score,
        })),
        totalContacts: conns.length,
      });
    }

    // Sort by funding date desc, then amount
    return signals
      .sort((a, b) => {
        if (a.fundingDate && b.fundingDate) return b.fundingDate.localeCompare(a.fundingDate);
        if (a.fundingDate) return -1;
        if (b.fundingDate) return 1;
        return (b.fundingAmount ?? 0) - (a.fundingAmount ?? 0);
      })
      .slice(0, 5);
  }, [connections]);

  const seniorityBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of connections) {
      const tier = c.seniority_tier || "Other";
      map.set(tier, (map.get(tier) || 0) + 1);
    }
    return [...map.entries()]
      .map(([tier, count]) => ({ tier, count }))
      .sort((a, b) => b.count - a.count);
  }, [connections]);

  const industryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of connections) {
      if (c.company_industry && c.company_industry.toLowerCase() !== "unknown") {
        map.set(c.company_industry, (map.get(c.company_industry) || 0) + 1);
      }
    }
    return [...map.entries()]
      .map(([industry, count]) => ({ industry, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [connections]);

  const geoBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of connections) {
      if (c.country_full_name) {
        map.set(c.country_full_name, (map.get(c.country_full_name) || 0) + 1);
      }
    }
    return [...map.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [connections]);

  const timeline = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of connections) {
      if (c.connected_on) {
        const date = new Date(c.connected_on);
        if (!isNaN(date.getTime())) {
          const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          map.set(period, (map.get(period) || 0) + 1);
        }
      }
    }
    return [...map.entries()]
      .map(([period, count]) => ({ period, count }))
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-12);
  }, [connections]);

  // --- State ---

  const pipelineActive = pipelineState.isRunning && pipelineState.step !== "completed";
  const isFreeTier = subscriptionTier === "free";
  const showDashboard = processingStatus === "completed" && connections.length > 0;

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/dashboard/query?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const firstName = profile.full_name
    ? (profile.full_name as string).split(" ")[0]
    : null;

  // --- Hit list breakdown text ---
  const hitListSubtext = useMemo(() => {
    const parts: string[] = [];
    for (const [type, count] of hitListMatches.byType) {
      const label = type.toLowerCase() === "customer" ? "customers" :
                    type.toLowerCase() === "investor" ? "investors" :
                    type.toLowerCase() === "advisor" ? "advisors" : type;
      parts.push(`${count} ${label}`);
    }
    return parts.join(" · ");
  }, [hitListMatches]);

  // --- Geo total for percentages ---
  const geoTotal = useMemo(() => geoBreakdown.reduce((a, b) => a + b.count, 0), [geoBreakdown]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#0A2540]">
          {firstName ? `${firstName}'s Network` : "Your Network"}
        </h1>
        <p className="text-sm text-[#596780] mt-1">
          Your network intelligence at a glance
        </p>
      </div>

      {/* Pipeline progress */}
      {pipelineActive && (
        <PipelineProgress state={pipelineState} onRefresh={pipelineState.refresh} />
      )}

      {/* Upgrade banner */}
      {isFreeTier && connections.length > 100 && (
        <UpgradeBanner totalConnections={connections.length} />
      )}

      {/* Search bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#96A0B5]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Search your network... "VCs who invest in fintech"'
            className="w-full h-11 pl-11 pr-12 rounded-lg border border-[#E3E8EF] bg-white text-sm text-[#0A2540] placeholder:text-[#96A0B5] hover:border-[#94A3B8] focus:border-[#0ABF53] focus:ring-1 focus:ring-[#0ABF53]/20 outline-none transition-all"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-[#0ABF53] flex items-center justify-center hover:bg-[#089E45] transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </form>

      {showDashboard ? (
        <div className="space-y-4">
          {/* Top 3 stat boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link href="/dashboard/hit-list" className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm p-6 hover:border-[#0ABF53]/30 transition-all group">
              <Target className="w-5 h-5 text-[#0ABF53] mb-2" strokeWidth={1.5} />
              <p className="text-3xl font-bold text-[#0A2540] tabular-nums">{hitListMatches.total}</p>
              <p className="text-xs font-medium text-[#596780] uppercase tracking-wide mt-1">Hit List Matches</p>
              {hitListSubtext && (
                <p className="text-xs text-[#96A0B5] mt-2">{hitListSubtext}</p>
              )}
            </Link>

            <div className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm p-6">
              <Building2 className="w-5 h-5 text-[#0ABF53] mb-2" strokeWidth={1.5} />
              <p className="text-3xl font-bold text-[#0A2540] tabular-nums">{icpFitCompanies.total}</p>
              <p className="text-xs font-medium text-[#596780] uppercase tracking-wide mt-1">ICP-Fit Companies</p>
              {icpFitCompanies.industries > 0 && (
                <p className="text-xs text-[#96A0B5] mt-2">across {icpFitCompanies.industries} industries</p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm p-6">
              <DollarSign className="w-5 h-5 text-[#0ABF53] mb-2" strokeWidth={1.5} />
              <p className="text-3xl font-bold text-[#0A2540] tabular-nums">{recentlyFunded.total}</p>
              <p className="text-xs font-medium text-[#596780] uppercase tracking-wide mt-1">Recently Funded</p>
              <p className="text-xs text-[#96A0B5] mt-2">companies in your network raised capital</p>
            </div>
          </div>

          {/* Network Spotlight — AI-powered summary */}
          <NetworkSpotlight />

          {/* Funding Signals */}
          {fundingSignals.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm p-5">
              <h3 className="text-sm font-semibold text-[#0A2540] mb-1 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#0ABF53]" strokeWidth={1.5} />
                Funding Signals
              </h3>
              <p className="text-xs text-[#96A0B5] mb-4">Companies in your network that recently raised capital</p>
              <div className="space-y-3">
                {fundingSignals.map((signal) => (
                  <div key={signal.company} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#E6F9EE] flex items-center justify-center shrink-0 mt-0.5">
                      <DollarSign className="w-4 h-4 text-[#0ABF53]" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[#0A2540]">{signal.company}</span>
                        <span className="text-xs text-[#596780]">
                          {signal.fundingType}
                          {signal.fundingAmount ? ` · ${formatFunding(signal.fundingAmount)}` : ""}
                          {signal.fundingDate &&
                            ` · ${new Date(signal.fundingDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
                        </span>
                      </div>
                      <p className="text-xs text-[#96A0B5] mt-0.5">
                        You know {signal.totalContacts} {signal.totalContacts === 1 ? "person" : "people"}
                        {signal.contacts[0] && (
                          <>
                            {" "}including {signal.contacts[0].name}
                            {signal.contacts[0].title && ` (${signal.contacts[0].title})`}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Seniority Mix + Top Industries */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {seniorityBreakdown.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm p-5">
                <h3 className="text-sm font-semibold text-[#0A2540] mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#0ABF53]" strokeWidth={1.5} />
                  Seniority Mix
                </h3>
                <div className="flex items-center gap-4">
                  <div className="w-[140px] h-[140px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={seniorityBreakdown}
                          dataKey="count"
                          nameKey="tier"
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={65}
                          strokeWidth={2}
                          stroke="#fff"
                        >
                          {seniorityBreakdown.map((_, i) => (
                            <Cell key={i} fill={SENIORITY_COLORS[i % SENIORITY_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    {seniorityBreakdown.slice(0, 5).map((item, i) => (
                      <div key={item.tier} className="flex items-center gap-2 text-xs">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: SENIORITY_COLORS[i % SENIORITY_COLORS.length] }}
                        />
                        <span className="text-[#596780] truncate flex-1">{item.tier}</span>
                        <span className="font-semibold text-[#0A2540] tabular-nums">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {industryBreakdown.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm p-5">
                <h3 className="text-sm font-semibold text-[#0A2540] mb-4 flex items-center gap-2">
                  <Factory className="w-4 h-4 text-[#0ABF53]" strokeWidth={1.5} />
                  Top Industries
                </h3>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={industryBreakdown.slice(0, 6)}
                      layout="vertical"
                      margin={{ left: 0, right: 10, top: 0, bottom: 0 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="industry"
                        width={130}
                        tick={{ fontSize: 11, fill: "#596780" }}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={14}>
                        {industryBreakdown.slice(0, 6).map((_, i) => (
                          <Cell
                            key={i}
                            fill={i === 0 ? "#0ABF53" : i === 1 ? "#2DD375" : i === 2 ? "#34D399" : i === 3 ? "#6EE7B7" : i === 4 ? "#A7F3D0" : "#D1FAE5"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Geography + Connection Timeline */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {geoBreakdown.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm p-5">
                <h3 className="text-sm font-semibold text-[#0A2540] mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#0ABF53]" strokeWidth={1.5} />
                  Geography
                </h3>
                <div className="space-y-2.5">
                  {geoBreakdown.map((item) => {
                    const pct = geoTotal > 0 ? Math.round((item.count / geoTotal) * 100) : 0;
                    return (
                      <div key={item.country}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-[#596780] font-medium">{item.country}</span>
                          <span className="font-semibold text-[#0A2540] tabular-nums">
                            {item.count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 bg-[#F0F3F7] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(90deg, ${PRIMARY_GREEN}, #34D399)`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {timeline.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E3E8EF] shadow-sm p-5">
                <h3 className="text-sm font-semibold text-[#0A2540] mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#0ABF53]" strokeWidth={1.5} />
                  Connection Timeline
                </h3>
                <div className="h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeline} margin={{ left: 0, right: 0, top: 5, bottom: 0 }}>
                      <defs>
                        <linearGradient id="timeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={PRIMARY_GREEN} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={PRIMARY_GREEN} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="period"
                        tickFormatter={formatPeriod}
                        tick={{ fontSize: 10, fill: "#596780" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label) => formatPeriod(String(label))}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke={PRIMARY_GREEN}
                        strokeWidth={1.5}
                        fill="url(#timeGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : loading ? (
        /* Skeleton loading state */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SkeletonBox className="h-32" />
            <SkeletonBox className="h-32" />
            <SkeletonBox className="h-32" />
          </div>
          <SkeletonBox className="h-64" />
          <SkeletonBox className="h-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonBox className="h-52" />
            <SkeletonBox className="h-52" />
          </div>
        </div>
      ) : !pipelineActive ? (
        <div className="bg-white rounded-xl border border-[#E3E8EF] p-10 text-center">
          <div className="animate-fade-in-up">
            <div className="w-16 h-16 bg-[#E6F9EE] rounded-xl flex items-center justify-center mx-auto mb-5">
              <Target className="w-7 h-7 text-[#0ABF53]" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold text-[#0A2540]">
              {processingStatus === "completed"
                ? "Analysis complete!"
                : "Your network is being analyzed"}
            </h3>
            <p className="text-sm text-[#596780] mt-2 max-w-sm mx-auto leading-relaxed">
              {processingStatus === "completed"
                ? "Your connections have been analyzed. Explore your network insights."
                : "Insights will appear here once processing completes. Check back soon."}
            </p>
            {processingStatus === "completed" && (
              <Link
                href="/dashboard/hit-list"
                className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-lg btn-primary-gradient text-sm font-medium"
              >
                View Hit List
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
