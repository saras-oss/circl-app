"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import PipelineProgress from "./PipelineProgress";
import UpgradeBanner from "./UpgradeBanner";
import { usePipelineOrchestrator } from "@/hooks/usePipelineOrchestrator";
import {
  Search,
  Sparkles,
  Users,
  TrendingUp,
  MapPin,
  Building2,
  GraduationCap,
  Banknote,
  Briefcase,
  ArrowRight,
  Calendar,
} from "lucide-react";
import Link from "next/link";
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

interface InsightsData {
  total_connections: number;
  enriched_count: number;
  scored_count: number;
  seniority_breakdown: { tier: string; count: number }[];
  industry_breakdown: { industry: string; count: number }[];
  geo_breakdown: { country: string; count: number }[];
  timeline: { period: string; count: number }[];
  top_companies: {
    company: string;
    count: number;
    industry?: string;
    employee_count?: number;
  }[];
  top_schools: { school: string; count: number }[];
  funding_signals: {
    company: string;
    funding_type: string;
    amount: number;
    date: string;
  }[];
  experience_stats: {
    avg_years: number;
    max_years: number;
    max_person: string | null;
    histogram: { bucket: string; count: number }[];
  };
}

interface DashboardClientProps {
  userId: string;
  profile: Record<string, unknown>;
  subscriptionTier: string;
  processingStatus: string;
}

const SENIORITY_COLORS = [
  "#1B4332",
  "#2D6A4F",
  "#40916C",
  "#52B788",
  "#74C69D",
  "#95D5B2",
  "#B7E4C7",
];
const CHART_GREEN = "#2D6A4F";
const CHART_GREEN_LIGHT = "#95D5B2";

const suggestedPrompts = [
  "Who are the founders in my network?",
  "Connections at companies that recently raised funding",
  "VCs and angel investors in my connections",
  "Senior leaders in my industry",
];

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

export default function DashboardClient({
  userId,
  profile,
  subscriptionTier,
  processingStatus,
}: DashboardClientProps) {
  const router = useRouter();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const pipelineState = usePipelineOrchestrator(userId, processingStatus);

  const hasRefreshedRef = useRef(false);

  const fetchInsights = useCallback(async () => {
    setLoadingInsights(true);
    try {
      const res = await fetch(`/api/dashboard/insights?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setInsights(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingInsights(false);
    }
  }, [userId]);

  // Fetch insights on mount if pipeline is completed
  useEffect(() => {
    if (processingStatus === "completed") {
      fetchInsights();
    }
  }, [processingStatus, fetchInsights]);

  // Refresh page when pipeline completes
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

  const pipelineActive =
    pipelineState.isRunning && pipelineState.step !== "completed";
  const isFreeTier = subscriptionTier === "free";
  const showWrapped = processingStatus === "completed" && insights;

  return (
    <div className="animate-fade-in">
      {/* Hero header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          {profile.full_name
            ? `${(profile.full_name as string).split(" ")[0]}'s Network`
            : "Your Network"}
        </h1>
        <p className="text-warm-500 text-sm mt-1">
          {showWrapped
            ? `${insights.total_connections.toLocaleString()} connections analyzed`
            : "Your network intelligence at a glance"}
        </p>
      </div>

      {/* Pipeline progress */}
      {pipelineActive && (
        <PipelineProgress state={pipelineState} onRefresh={pipelineState.refresh} />
      )}

      {isFreeTier && (insights?.total_connections || 0) > 100 && (
        <UpgradeBanner
          totalConnections={insights?.total_connections || 0}
        />
      )}

      {/* Query search box */}
      <div className="card-elevated p-5 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-warm-400" />
          <a
            href="/dashboard/query"
            className="flex items-center w-full h-[52px] pl-12 pr-4 rounded-2xl border-2 border-border bg-warm-50 text-sm text-warm-400 hover:border-border-strong transition-all"
          >
            Search your network... &quot;VCs who invest in fintech&quot;
          </a>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {suggestedPrompts.map((prompt) => (
            <a
              key={prompt}
              href={`/dashboard/query?q=${encodeURIComponent(prompt)}`}
              className="text-xs px-3.5 py-2 rounded-full bg-warm-100 text-warm-600 hover:bg-warm-200 hover:text-foreground transition-all font-medium"
            >
              {prompt}
            </a>
          ))}
        </div>
      </div>

      {/* Network Wrapped - insight cards */}
      {showWrapped ? (
        <div className="space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card-elevated p-4 text-center">
              <Users className="w-5 h-5 text-accent mx-auto mb-2" strokeWidth={1.8} />
              <p className="text-2xl font-bold tracking-tight">{insights.total_connections.toLocaleString()}</p>
              <p className="text-xs text-warm-500 mt-0.5 font-medium">Connections</p>
            </div>
            <div className="card-elevated p-4 text-center">
              <Sparkles className="w-5 h-5 text-accent mx-auto mb-2" strokeWidth={1.8} />
              <p className="text-2xl font-bold tracking-tight">{insights.enriched_count}</p>
              <p className="text-xs text-warm-500 mt-0.5 font-medium">Enriched</p>
            </div>
            <div className="card-elevated p-4 text-center">
              <TrendingUp className="w-5 h-5 text-accent mx-auto mb-2" strokeWidth={1.8} />
              <p className="text-2xl font-bold tracking-tight">{insights.scored_count}</p>
              <p className="text-xs text-warm-500 mt-0.5 font-medium">Scored</p>
            </div>
          </div>

          {/* Row 1: Seniority donut + Industries bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Seniority donut */}
            {insights.seniority_breakdown.length > 0 && (
              <div className="card-elevated p-5">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-accent" strokeWidth={2} />
                  Seniority Mix
                </h3>
                <div className="flex items-center gap-4">
                  <div className="w-[140px] h-[140px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={insights.seniority_breakdown}
                          dataKey="count"
                          nameKey="tier"
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={65}
                          strokeWidth={2}
                          stroke="#fff"
                        >
                          {insights.seniority_breakdown.map((_, i) => (
                            <Cell key={i} fill={SENIORITY_COLORS[i % SENIORITY_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: "12px", fontSize: "12px", border: "1px solid #e5e5e5" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    {insights.seniority_breakdown.slice(0, 5).map((item, i) => (
                      <div key={item.tier} className="flex items-center gap-2 text-xs">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: SENIORITY_COLORS[i % SENIORITY_COLORS.length] }}
                        />
                        <span className="text-warm-600 truncate flex-1">{item.tier}</span>
                        <span className="font-semibold text-foreground tabular-nums">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Industries bar */}
            {insights.industry_breakdown.length > 0 && (
              <div className="card-elevated p-5">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-accent" strokeWidth={2} />
                  Top Industries
                </h3>
                <div className="h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={insights.industry_breakdown.slice(0, 6)}
                      layout="vertical"
                      margin={{ left: 0, right: 10, top: 0, bottom: 0 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="industry"
                        width={100}
                        tick={{ fontSize: 11, fill: "#78716c" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: "12px", fontSize: "12px", border: "1px solid #e5e5e5" }}
                      />
                      <Bar dataKey="count" fill={CHART_GREEN} radius={[0, 6, 6, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Row 2: Geo + Timeline */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Geography */}
            {insights.geo_breakdown.length > 0 && (
              <div className="card-elevated p-5">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-accent" strokeWidth={2} />
                  Geography
                </h3>
                <div className="space-y-2">
                  {insights.geo_breakdown.slice(0, 5).map((item, i) => {
                    const total = insights.geo_breakdown.reduce((a, b) => a + b.count, 0);
                    const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                    return (
                      <div key={item.country}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-warm-600 font-medium">{item.country}</span>
                          <span className="font-semibold text-foreground tabular-nums">
                            {item.count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 bg-warm-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: SENIORITY_COLORS[i % SENIORITY_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Connection timeline */}
            {insights.timeline.length > 0 && (
              <div className="card-elevated p-5">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-accent" strokeWidth={2} />
                  Connection Timeline
                </h3>
                <div className="h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={insights.timeline.slice(-12)}
                      margin={{ left: 0, right: 0, top: 5, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="timeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_GREEN} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_GREEN} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="period"
                        tickFormatter={formatPeriod}
                        tick={{ fontSize: 10, fill: "#78716c" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ borderRadius: "12px", fontSize: "12px", border: "1px solid #e5e5e5" }}
                        labelFormatter={(label) => formatPeriod(String(label))}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke={CHART_GREEN}
                        strokeWidth={2}
                        fill="url(#timeGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Row 3: Top Companies + Education */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top companies */}
            {insights.top_companies.length > 0 && (
              <div className="card-elevated p-5">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-accent" strokeWidth={2} />
                  Top Companies
                </h3>
                <div className="space-y-2.5">
                  {insights.top_companies.map((item, i) => (
                    <div key={item.company} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-warm-100 flex items-center justify-center text-xs font-bold text-warm-500 shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{item.company}</p>
                        {item.industry && (
                          <p className="text-[11px] text-warm-400 truncate">{item.industry}</p>
                        )}
                      </div>
                      <span className="text-sm font-bold text-foreground tabular-nums">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {insights.top_schools.length > 0 && (
              <div className="card-elevated p-5">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-accent" strokeWidth={2} />
                  Education Highlights
                </h3>
                <div className="space-y-2.5">
                  {insights.top_schools.map((item, i) => (
                    <div key={item.school} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-warm-100 flex items-center justify-center text-xs font-bold text-warm-500 shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.school}</p>
                      </div>
                      <span className="text-sm font-bold text-foreground tabular-nums">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Row 4: Funding Signals + Experience */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Funding signals */}
            {insights.funding_signals.length > 0 && (
              <div className="card-elevated p-5">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-accent" strokeWidth={2} />
                  Funding Signals
                </h3>
                <div className="space-y-2.5">
                  {insights.funding_signals.map((item) => (
                    <div key={`${item.company}-${item.date}`} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                        <Banknote className="w-4 h-4 text-green-600" strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{item.company}</p>
                        <p className="text-[11px] text-warm-400">
                          {item.funding_type}{item.amount > 0 ? ` · ${formatFunding(item.amount)}` : ""}
                        </p>
                      </div>
                      <span className="text-[11px] text-warm-400 tabular-nums shrink-0">
                        {new Date(item.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Experience distribution */}
            {insights.experience_stats.histogram.some((b) => b.count > 0) && (
              <div className="card-elevated p-5">
                <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-accent" strokeWidth={2} />
                  Experience Distribution
                </h3>
                <p className="text-[11px] text-warm-400 mb-3">
                  Avg {insights.experience_stats.avg_years} years
                  {insights.experience_stats.max_person && (
                    <> · Most experienced: {insights.experience_stats.max_person}</>
                  )}
                </p>
                <div className="h-[120px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={insights.experience_stats.histogram}
                      margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="bucket"
                        tick={{ fontSize: 10, fill: "#78716c" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ borderRadius: "12px", fontSize: "12px", border: "1px solid #e5e5e5" }}
                        formatter={(value) => [`${value} people`, "Count"]}
                      />
                      <Bar dataKey="count" fill={CHART_GREEN_LIGHT} radius={[6, 6, 0, 0]} barSize={24}>
                        {insights.experience_stats.histogram.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.count > 0 ? CHART_GREEN : "#e7e5e4"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* CTA to Hit List */}
          <Link
            href="/dashboard/hit-list"
            className="card-elevated p-5 flex items-center gap-4 hover:border-accent/30 transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-accent-light flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6 text-accent" strokeWidth={1.8} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">View your Hit List</p>
              <p className="text-xs text-warm-500 mt-0.5">
                {insights.scored_count > 0
                  ? `${insights.scored_count} scored matches ready to explore`
                  : "Your top-scored connections ranked by relevance"}
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-warm-400 group-hover:text-accent transition-colors" />
          </Link>
        </div>
      ) : !pipelineActive ? (
        /* Empty / loading state */
        <div className="card-elevated p-10 text-center">
          <div className="animate-fade-in-up">
            <div className="w-16 h-16 bg-accent-light rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Sparkles className="w-7 h-7 text-accent" strokeWidth={1.5} />
            </div>
            {loadingInsights ? (
              <>
                <h3 className="text-lg font-bold tracking-tight">Loading your insights...</h3>
                <p className="text-sm text-warm-500 mt-2">Crunching the numbers on your network</p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold tracking-tight">
                  {processingStatus === "completed"
                    ? "Analysis complete!"
                    : "Your network is being analyzed"}
                </h3>
                <p className="text-sm text-warm-500 mt-2 max-w-sm mx-auto leading-relaxed">
                  {processingStatus === "completed"
                    ? "Your connections have been analyzed. Explore your network insights."
                    : "Insights will appear here once processing completes. Check back soon."}
                </p>
                {processingStatus === "completed" && (
                  <Link
                    href="/dashboard/hit-list"
                    className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-all"
                  >
                    View Hit List
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
