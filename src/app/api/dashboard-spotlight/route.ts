/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";
import { callAnthropicWithRetry } from "@/lib/anthropic-retry";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch user profile + ICP
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("full_name, company_name, icp_data")
      .eq("id", user.id)
      .single();

    const icpData =
      typeof userData?.icp_data === "string"
        ? JSON.parse(userData.icp_data)
        : userData?.icp_data || {};

    // Fetch top 30 connections by score
    const { data: topConnections } = await supabaseAdmin
      .from("network_view")
      .select(
        "first_name, last_name, current_title, csv_position, current_company, csv_company, company_name, company_industry, company_size_min, company_size_max, company_type, latest_funding_type, latest_funding_amount, total_funding_amount, latest_funding_date, hq_city, hq_country, seniority_tier, match_score, match_type, match_reasons, location_str, city, country_full_name, total_experience_years, previous_companies, connected_on"
      )
      .eq("user_id", user.id)
      .not("match_score", "is", null)
      .order("match_score", { ascending: false, nullsFirst: false })
      .limit(30);

    // Basic network stats
    const { count: totalConnections } = await supabaseAdmin
      .from("network_view")
      .select("connection_id", { count: "exact", head: true })
      .eq("user_id", user.id);

    const { count: enrichedCount } = await supabaseAdmin
      .from("network_view")
      .select("connection_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("current_title", "is", null);

    const { count: hitListCount } = await supabaseAdmin
      .from("network_view")
      .select("connection_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("match_score", 7);

    // Recently funded company connections
    const { data: fundedConnections } = await supabaseAdmin
      .from("network_view")
      .select(
        "first_name, last_name, current_title, current_company, company_name, company_industry, latest_funding_type, latest_funding_amount, latest_funding_date, match_score, seniority_tier, previous_companies"
      )
      .eq("user_id", user.id)
      .not("latest_funding_type", "is", null)
      .order("latest_funding_amount", { ascending: false, nullsFirst: false })
      .limit(10);

    // Build payloads
    const connectionsPayload = (topConnections || []).map((c: any) => ({
      name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
      title: c.current_title || c.csv_position || "",
      company: c.current_company || c.csv_company || "",
      industry: c.company_industry || "",
      score: c.match_score,
      match_type: c.match_type || "",
      seniority: c.seniority_tier || "",
      location: c.location_str || c.city || "",
      country: c.country_full_name || "",
      company_size:
        c.company_size_min && c.company_size_max
          ? `${c.company_size_min}-${c.company_size_max}`
          : "",
      funding: c.latest_funding_type || "",
      funding_amount: c.latest_funding_amount || "",
      total_raised: c.total_funding_amount || "",
      funding_date: c.latest_funding_date || "",
      experience_years: c.total_experience_years || "",
      previous_companies: c.previous_companies || [],
      connected_on: c.connected_on || "",
    }));

    const fundedPayload = (fundedConnections || []).map((c: any) => ({
      name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
      title: c.current_title || "",
      company: c.company_name || c.current_company || "",
      industry: c.company_industry || "",
      funding: c.latest_funding_type || "",
      funding_amount: c.latest_funding_amount || "",
      funding_date: c.latest_funding_date || "",
      score: c.match_score,
      seniority: c.seniority_tier || "",
      previous_companies: c.previous_companies || [],
    }));

    // Single Haiku call with all the data
    const anthropic = new Anthropic();

    const response = await callAnthropicWithRetry(() =>
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `You are a sharp B2B sales intelligence analyst giving a 60-second verbal briefing to ${userData?.full_name || "the user"} who runs ${userData?.company_name || "their company"}.

Their ICP targets: ${icpData.industries?.join(", ") || "Not specified"} industries, ${icpData.titles?.join(", ") || "various"} titles, ${icpData.geographies?.join(", ") || "global"} geographies, company sizes: ${icpData.companySizes?.join(", ") || "any"}.

Network stats: ${totalConnections || 0} total connections, ${enrichedCount || 0} enriched, ${hitListCount || 0} hit list matches (score 7+).

Here are their top 30 connections by match score:
${JSON.stringify(connectionsPayload, null, 0)}

Here are connections at recently funded companies:
${JSON.stringify(fundedPayload, null, 0)}

Write a 3-paragraph briefing. No headers, no bullet points, no numbered lists. Bold all people names and company names using **bold** markdown. Keep it under 200 words total.

Paragraph 1 — WHO MATTERS MOST: Name 3-4 highest-value connections with their exact title and company. For each, explain WHY they matter — their company just raised funding, they're C-suite at an ICP-fit company, they're an investor, their company size matches the ICP, etc. Don't just list names — connect the dots.

Paragraph 2 — HIDDEN GEMS: Find something non-obvious in the data. A person whose previous_companies includes a target company (warm intro path). An investor connection. A cluster of multiple connections at one company. Someone at a recently funded company where timing is right. Something the user wouldn't spot scrolling a list.

Paragraph 3 — ONE MOVE TO MAKE: Name ONE specific person to reach out to this week. State why now (recent funding, ICP fit, seniority, etc.) and give a one-sentence angle for the outreach message. Be specific and actionable.

Write like a sharp colleague over coffee, not a report. No generic filler like "diverse network" or "strong composition."`,
          },
        ],
      })
    );

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ text });
  } catch (err: unknown) {
    console.error("Dashboard spotlight error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate spotlight";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
