"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Download } from "lucide-react";

interface ExportCSVProps {
  question: string;
  results: any[];
  textAnswer: string;
}

function formatAmount(amount: number | null | undefined): string {
  if (!amount) return "";
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${Math.round(amount / 1_000_000)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${amount}`;
}

function escapeCSVCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default function ExportCSV({ question, results, textAnswer }: ExportCSVProps) {
  if (!results || results.length === 0) return null;

  function handleExport() {
    const rows: string[][] = [];

    // Row 1: Question
    rows.push([`Question: ${question}`]);

    // Row 2: Summary
    const cleanAnswer = textAnswer.replace(/\*\*/g, "").replace(/\n/g, " ").substring(0, 500);
    rows.push([`Summary: ${cleanAnswer}`]);

    // Row 3: Empty
    rows.push([]);

    // Row 4: Headers
    rows.push([
      "Name", "Title", "Company", "Industry", "Location", "Seniority",
      "Experience (Years)", "Company Size", "Company Type", "Funding Stage",
      "Funding Amount", "Total Raised", "Connected Since", "LinkedIn URL",
      "Company Website",
    ]);

    // Data rows
    for (const r of results) {
      let companySize = "";
      if (r.company_size_min && r.company_size_max) {
        companySize = `${r.company_size_min}-${r.company_size_max}`;
      } else if (r.company_size_min) {
        companySize = `${r.company_size_min}+`;
      }

      let connectedSince = "";
      if (r.connected_on) {
        try {
          connectedSince = new Date(r.connected_on).toLocaleDateString("en-US", {
            month: "short", year: "numeric",
          });
        } catch { /* ignore */ }
      }

      rows.push([
        `${r.first_name || ""} ${r.last_name || ""}`.trim(),
        r.current_title || r.csv_position || "",
        r.current_company || r.csv_company || "",
        r.company_industry || "",
        r.location_str || r.city || "",
        r.seniority_tier || "",
        r.total_experience_years ? `${r.total_experience_years}` : "",
        companySize,
        r.company_type || "",
        r.latest_funding_type || "",
        formatAmount(r.latest_funding_amount),
        formatAmount(r.total_funding_amount),
        connectedSince,
        r.linkedin_url || "",
        r.company_website || "",
      ]);
    }

    const csvContent = rows
      .map((row) => row.map((cell) => escapeCSVCell(String(cell || ""))).join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    const slug = question
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 40);
    const date = new Date().toISOString().split("T")[0];
    link.download = `circl-${slug}-${date}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 text-xs text-[#96A0B5] hover:text-[#596780] transition px-3 py-2 border border-[#E3E8EF] rounded-lg hover:bg-[#F6F8FA]"
    >
      <Download className="w-3.5 h-3.5" />
      Export results ({results.length})
    </button>
  );
}
