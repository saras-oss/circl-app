"use client";

import { useState } from "react";
import ProcessingBanner from "./ProcessingBanner";
import UpgradeBanner from "./UpgradeBanner";
import HitListCard from "./HitListCard";
import { Search, Sparkles, Users, TrendingUp, UserCheck } from "lucide-react";

interface Match {
  id: string;
  score: number;
  match_type: "customer" | "investor" | "advisor";
  reason: string;
  ai_reason: string;
  data_points: Record<string, string>;
  user_connections: {
    first_name: string;
    last_name: string;
    company: string;
    position: string;
    connected_on: string;
  };
}

interface DashboardClientProps {
  userId: string;
  profile: Record<string, unknown>;
  matches: Match[];
}

const suggestedPrompts = [
  "Who are the founders in my network?",
  "Connections at companies that recently raised funding",
  "VCs and angel investors in my connections",
  "Senior leaders who could be advisors",
];

export default function DashboardClient({
  userId,
  profile,
  matches,
}: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<
    "customer" | "investor" | "advisor"
  >("customer");
  const [filter, setFilter] = useState<"all" | "exceptional" | "strong">(
    "all"
  );

  const isFreeTier = profile.subscription_tier === "free";
  const isProcessing =
    profile.processing_status !== "idle" &&
    profile.processing_status !== "completed";

  const filteredMatches = matches.filter((m) => {
    if (m.match_type !== activeTab) return false;
    if (filter === "exceptional") return m.score >= 9;
    if (filter === "strong") return m.score >= 7;
    return true;
  });

  const tabs = [
    {
      key: "customer" as const,
      label: "Customers",
      icon: Users,
      count: matches.filter((m) => m.match_type === "customer").length,
      color: "text-accent",
      bg: "bg-accent-light",
    },
    {
      key: "investor" as const,
      label: "Investors",
      icon: TrendingUp,
      count: matches.filter((m) => m.match_type === "investor").length,
      color: "text-purple",
      bg: "bg-purple-light",
    },
    {
      key: "advisor" as const,
      label: "Advisors",
      icon: UserCheck,
      count: matches.filter((m) => m.match_type === "advisor").length,
      color: "text-gold",
      bg: "bg-gold-light",
    },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          {profile.full_name ? `Welcome back, ${(profile.full_name as string).split(" ")[0]}` : "Welcome back"}
        </h1>
        <p className="text-warm-500 text-sm mt-1">
          Your network intelligence at a glance
        </p>
      </div>

      {isProcessing && <ProcessingBanner userId={userId} />}
      {isFreeTier && (profile.total_connections as number) > 100 && (
        <UpgradeBanner
          totalConnections={profile.total_connections as number}
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

      {/* Summary stats */}
      {matches.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6 stagger-children">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`card-elevated p-4 text-center transition-all duration-200 ${
                activeTab === tab.key ? "border-border-strong shadow-md" : ""
              }`}
            >
              <div className={`w-10 h-10 ${tab.bg} rounded-xl flex items-center justify-center mx-auto mb-2.5`}>
                <tab.icon className={`w-5 h-5 ${tab.color}`} strokeWidth={1.8} />
              </div>
              <p className="text-2xl font-bold tracking-tight">{tab.count}</p>
              <p className="text-xs text-warm-500 mt-0.5 font-medium">{tab.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface rounded-2xl p-1.5 border border-border mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 h-11 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === tab.key
                ? "bg-foreground text-white shadow-sm"
                : "text-warm-400 hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1.5 text-xs ${activeTab === tab.key ? "opacity-60" : "opacity-50"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-5">
        {(["all", "exceptional", "strong"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-9 px-4 rounded-full text-xs font-semibold border transition-all duration-200 ${
              filter === f
                ? f === "exceptional"
                  ? "badge-exceptional"
                  : f === "strong"
                    ? "badge-strong"
                    : "bg-foreground text-white border-foreground"
                : "bg-surface text-warm-500 border-border hover:border-border-strong"
            }`}
          >
            {f === "all"
              ? "All Matches"
              : f === "exceptional"
                ? "Exceptional 9-10"
                : "Strong 7-8"}
          </button>
        ))}
      </div>

      {/* Results */}
      {matches.length === 0 ? (
        <div className="card-elevated p-10 text-center">
          {isProcessing ? (
            <div className="animate-fade-in-up">
              <div className="w-16 h-16 bg-accent-light rounded-2xl flex items-center justify-center mx-auto mb-5">
                <div className="w-7 h-7 border-[2.5px] border-accent border-t-transparent rounded-full animate-spin" />
              </div>
              <h3 className="text-lg font-bold tracking-tight">Analyzing your network</h3>
              <p className="text-sm text-warm-500 mt-2 max-w-sm mx-auto leading-relaxed">
                We&apos;re enriching and scoring your connections. This usually
                takes 15–30 minutes.
              </p>
            </div>
          ) : (
            <div className="animate-fade-in-up">
              <div className="w-16 h-16 bg-warm-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Sparkles className="w-7 h-7 text-warm-400" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-bold tracking-tight">Your hit list is being prepared</h3>
              <p className="text-sm text-warm-500 mt-2 max-w-sm mx-auto leading-relaxed">
                Matches will appear here once processing completes. Check back
                soon.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 stagger-children">
          {filteredMatches.map((match, i) => (
            <HitListCard
              key={match.id}
              name={`${match.user_connections.first_name} ${match.user_connections.last_name}`}
              title={match.user_connections.position}
              company={match.user_connections.company}
              score={Number(match.score)}
              matchType={match.match_type}
              reason={match.ai_reason || match.reason || ""}
              connectedOn={match.user_connections.connected_on}
              dataPoints={match.data_points}
              blurred={isFreeTier && i >= 5}
            />
          ))}
        </div>
      )}
    </div>
  );
}
