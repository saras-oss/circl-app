"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

interface AggregateChartProps {
  data: { label: string; value: number }[];
}

const BAR_COLORS = [
  "#0ABF53",
  "#1BC964",
  "#2DD375",
  "#47D988",
  "#5EDF99",
  "#76E5AA",
  "#8EEBBB",
  "#A6F1CC",
  "#BEF7DD",
  "#D6FDEE",
];

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0A2540] text-white text-xs rounded-lg px-3 py-2 shadow-lg">
        <p className="font-medium">{label}</p>
        <p className="text-gray-300">{Math.round(payload[0].value)} connections</p>
      </div>
    );
  }
  return null;
}

export default function AggregateChart({ data }: AggregateChartProps) {
  const MAX_BARS = 10;
  const display = data.slice(0, MAX_BARS);
  const remaining = data.length - MAX_BARS;

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(window.innerWidth < 640);
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="mt-4">
      <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-4 sm:p-6">
        <div style={{ width: "100%", height: Math.max(display.length * (isMobile ? 52 : 44), isMobile ? 250 : 200) }}>
          <ResponsiveContainer>
            <BarChart
              data={display}
              layout="vertical"
              margin={isMobile
                ? { top: 0, right: 50, bottom: 0, left: 0 }
                : { top: 0, right: 40, bottom: 0, left: 0 }
              }
            >
              <XAxis
                type="number"
                tickFormatter={(v) => Math.round(v).toString()}
                tick={{ fontSize: isMobile ? 10 : 11, fill: "#96A0B5" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={isMobile ? 110 : 180}
                tick={{ fontSize: isMobile ? 11 : 12, fill: "#374151" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(label: string) => {
                  if (isMobile && label.length > 16) {
                    return label.substring(0, 14) + "...";
                  }
                  return label;
                }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F6F8FA" }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={isMobile ? 24 : 28}>
                {display.map((_, idx) => (
                  <Cell key={idx} fill={BAR_COLORS[idx] || BAR_COLORS[BAR_COLORS.length - 1]} />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(v: any) => Math.round(Number(v)).toString()}
                  style={{ fontSize: isMobile ? 11 : 12, fill: "#0A2540", fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {remaining > 0 && (
        <p className="text-xs text-[#96A0B5] mt-2 text-center">
          and {remaining} more
        </p>
      )}
    </div>
  );
}
