"use client";

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

export default function AggregateChart({ data }: AggregateChartProps) {
  const MAX_BARS = 10;
  const display = data.slice(0, MAX_BARS);
  const remaining = data.length - MAX_BARS;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E3E8EF] p-5">
      <div style={{ width: "100%", height: Math.max(display.length * 40, 200) }}>
        <ResponsiveContainer>
          <BarChart
            data={display}
            layout="vertical"
            margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={140}
              tick={{ fontSize: 13, fill: "#596780" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #E3E8EF",
                fontSize: 13,
              }}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={28}>
              {display.map((_, idx) => (
                <Cell key={idx} fill="#0ABF53" />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                style={{ fontSize: 13, fill: "#0A2540", fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {remaining > 0 && (
        <p className="text-xs text-[#96A0B5] mt-2 text-center">
          and {remaining} more
        </p>
      )}
    </div>
  );
}
