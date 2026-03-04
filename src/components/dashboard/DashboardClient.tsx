"use client";

import { useState } from "react";
import ProcessingBanner from "./ProcessingBanner";
import UpgradeBanner from "./UpgradeBanner";
import HitListCard from "./HitListCard";
import { Search } from "lucide-react";

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
  "Marketing directors at companies with 500+ employees",
  "Indian CTOs at Series B+ companies",
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
      count: matches.filter((m) => m.match_type === "customer").length,
    },
    {
      key: "investor" as const,
      label: "Investors",
      count: matches.filter((m) => m.match_type === "investor").length,
    },
    {
      key: "advisor" as const,
      label: "Advisors",
      count: matches.filter((m) => m.match_type === "advisor").length,
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          Welcome back{profile.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your network intelligence dashboard
        </p>
      </div>

      {isProcessing && <ProcessingBanner userId={userId} />}
      {isFreeTier && (profile.total_connections as number) > 100 && (
        <UpgradeBanner
          totalConnections={profile.total_connections as number}
        />
      )}

      {/* Query search box */}
      <div className="bg-white rounded-2xl border p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <a
            href="/dashboard/query"
            className="block w-full h-12 pl-12 pr-4 rounded-xl border bg-muted/50 text-sm text-muted-foreground flex items-center"
          >
            Search your network... &quot;VCs who invest in fintech&quot;
          </a>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {suggestedPrompts.slice(0, 3).map((prompt) => (
            <a
              key={prompt}
              href={`/dashboard/query?q=${encodeURIComponent(prompt)}`}
              className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground hover:bg-border transition-colors"
            >
              {prompt}
            </a>
          ))}
        </div>
      </div>

      {/* Summary banner */}
      {matches.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {tabs.map((tab) => (
            <div key={tab.key} className="bg-white rounded-2xl border p-4 text-center">
              <p className="text-2xl font-bold">{tab.count}</p>
              <p className="text-xs text-muted-foreground mt-1">{tab.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white rounded-xl p-1 border mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 h-10 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 text-xs opacity-70">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-4">
        {(["all", "exceptional", "strong"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-9 px-4 rounded-full text-xs font-medium border transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white text-muted-foreground border-border hover:border-primary/30"
            }`}
          >
            {f === "all"
              ? "All"
              : f === "exceptional"
                ? "Exceptional (9-10)"
                : "Strong (7-8)"}
          </button>
        ))}
      </div>

      {/* Results */}
      {matches.length === 0 ? (
        <div className="bg-white rounded-2xl border p-8 text-center">
          {isProcessing ? (
            <>
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
              <h3 className="font-semibold">Analyzing your network</h3>
              <p className="text-sm text-muted-foreground mt-2">
                We&apos;re enriching and scoring your connections. This usually
                takes 15–30 minutes.
              </p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold">Your hit list is being prepared</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Matches will appear here once processing completes. Check back
                soon.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
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
