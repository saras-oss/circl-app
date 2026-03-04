"use client";

interface HitListCardProps {
  name: string;
  title: string;
  company: string;
  score: number;
  matchType: "customer" | "investor" | "advisor";
  reason: string;
  connectedOn?: string;
  dataPoints?: Record<string, string>;
  blurred?: boolean;
}

function getScoreBadge(score: number) {
  if (score >= 9)
    return {
      label: "Exceptional",
      classes: "bg-gold-light text-amber-800 border-amber-200",
    };
  if (score >= 7)
    return {
      label: "Strong",
      classes: "bg-green-light text-emerald-800 border-emerald-200",
    };
  return {
    label: "Good",
    classes: "bg-gray-100 text-gray-700 border-gray-200",
  };
}

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
  const badge = getScoreBadge(score);

  return (
    <div
      className={`bg-white rounded-2xl border p-4 transition-shadow hover:shadow-md ${
        blurred ? "relative overflow-hidden" : ""
      }`}
    >
      {blurred && (
        <div className="absolute inset-0 backdrop-blur-sm bg-white/60 z-10 flex items-center justify-center">
          <div className="text-center px-4">
            <p className="text-sm font-medium text-primary">
              Upgrade to unlock
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This match is available on the paid plan
            </p>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm truncate">{name}</h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${badge.classes}`}
            >
              {score} — {badge.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            {title} at {company}
          </p>
        </div>
        <span className="shrink-0 text-xs px-2 py-1 rounded-lg bg-muted text-muted-foreground capitalize">
          {matchType}
        </span>
      </div>

      <p className="text-sm text-foreground/80 mt-3 line-clamp-2">{reason}</p>

      {dataPoints && Object.keys(dataPoints).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {Object.entries(dataPoints).map(([key, value]) => (
            <span
              key={key}
              className="text-xs px-2 py-1 rounded-lg bg-muted text-muted-foreground"
            >
              {value}
            </span>
          ))}
        </div>
      )}

      {connectedOn && (
        <p className="text-xs text-muted-foreground mt-3">
          Connected {connectedOn}
        </p>
      )}
    </div>
  );
}
