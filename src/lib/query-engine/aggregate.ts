/* eslint-disable @typescript-eslint/no-explicit-any */
import { AggregationResult } from "./types";

export function aggregateResults(
  data: any[],
  groupBy: string,
  metric: "count" | "avg_score"
): AggregationResult[] {
  const groups = new Map<string, number[]>();

  for (const row of data) {
    const key = String(row[groupBy] || "Unknown");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row.match_score || 0);
  }

  const results = Array.from(groups.entries()).map(([label, scores]) => ({
    label,
    value:
      metric === "count"
        ? scores.length
        : Math.round(
            (scores.reduce((a, b) => a + b, 0) / scores.length) * 10
          ) / 10,
  }));

  return results.sort((a, b) => b.value - a.value);
}
