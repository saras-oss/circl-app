"use client";

import { Lock, Users, TrendingUp } from "lucide-react";

interface HitListCardProps {
  name: string;
  title: string;
  company: string;
  score: number;
  matchType: "customer" | "investor";
  reason: string;
  connectedOn?: string;
  dataPoints?: Record<string, string>;
  blurred?: boolean;
}

const typeConfig = {
  customer: { icon: Users, color: "text-accent", bg: "bg-accent-light", label: "Customer" },
  investor: { icon: TrendingUp, color: "text-purple", bg: "bg-purple-light", label: "Investor" },
};

export default function HitListCard({
  name,
  title,
  company,
  score,
  matchType,
  reason,
  connectedOn,
  dataPoints,
  blurred = false,
}: HitListCardProps) {
  const config = typeConfig[matchType];
  const TypeIcon = config.icon;

  return (
    <div className={`card-elevated p-5 ${blurred ? "relative overflow-hidden" : ""}`}>
      {blurred && (
        <div className="absolute inset-0 backdrop-blur-md bg-surface/70 z-10 flex items-center justify-center">
          <div className="text-center px-6">
            <div className="w-10 h-10 bg-warm-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Lock className="w-4 h-4 text-warm-400" />
            </div>
            <p className="text-sm font-semibold">Upgrade to unlock</p>
            <p className="text-xs text-warm-500 mt-1">
              Available on paid plans
            </p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Avatar / Type icon */}
        <div className={`shrink-0 w-11 h-11 ${config.bg} rounded-xl flex items-center justify-center`}>
          <TypeIcon className={`w-5 h-5 ${config.color}`} strokeWidth={1.8} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Top row: name + score */}
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-sm truncate">{name}</h3>
            <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
              score >= 9 ? "badge-exceptional" : score >= 7 ? "badge-strong" : "bg-warm-100 text-warm-600 border border-warm-200"
            }`}>
              {score.toFixed(1)}
            </span>
          </div>

          {/* Subtitle */}
          <p className="text-sm text-warm-500 mt-0.5 truncate">
            {title}{company ? ` at ${company}` : ""}
          </p>

          {/* Reason */}
          <p className="text-[13px] text-warm-600 mt-2.5 leading-relaxed line-clamp-2">{reason}</p>

          {/* Data pills + meta */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex flex-wrap gap-1.5">
              {dataPoints && Object.entries(dataPoints).slice(0, 3).map(([key, value]) => (
                <span
                  key={key}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-warm-100 text-warm-600 font-medium"
                >
                  {value}
                </span>
              ))}
              <span className={`text-[11px] px-2.5 py-1 rounded-full ${config.bg} ${config.color} font-medium`}>
                {config.label}
              </span>
            </div>
            {connectedOn && (
              <span className="text-[11px] text-warm-400 shrink-0 ml-3">
                {connectedOn}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
