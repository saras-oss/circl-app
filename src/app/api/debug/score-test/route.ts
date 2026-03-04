import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

export async function GET() {
  // 1. Get the latest user
  const { data: user, error: userErr } = await supabaseAdmin
    .from("users")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (userErr || !user) return NextResponse.json({ error: "No user", detail: userErr });

  const rawIcp = user.icp_data;
  const icpData = typeof rawIcp === "string" ? JSON.parse(rawIcp) : rawIcp;

  // 2. Get ALL connections with their statuses for diagnostics
  const { data: allConns } = await supabaseAdmin
    .from("user_connections")
    .select("id, first_name, last_name, company, position, linkedin_url, enrichment_status, enrichment_tier, match_score, is_free_tier_selection, seniority_tier")
    .eq("user_id", user.id);

  const statusBreakdown: Record<string, number> = {};
  const tierBreakdown: Record<string, number> = {};
  const scoredCount = (allConns || []).filter((c) => c.match_score !== null).length;
  for (const c of allConns || []) {
    statusBreakdown[c.enrichment_status || "null"] = (statusBreakdown[c.enrichment_status || "null"] || 0) + 1;
    tierBreakdown[c.enrichment_tier || "null"] = (tierBreakdown[c.enrichment_tier || "null"] || 0) + 1;
  }

  // 3. Find ONE connection to test scoring on — prefer enriched/cached
  const testConn = (allConns || []).find(
    (c) => c.enrichment_status === "enriched" || c.enrichment_status === "cached"
  ) || (allConns || [])[0];

  if (!testConn) return NextResponse.json({ error: "No connections found" });

  // 4. Get enriched profile if exists
  const { data: profile } = testConn.linkedin_url
    ? await supabaseAdmin
        .from("enriched_profiles")
        .select("*")
        .eq("linkedin_url", testConn.linkedin_url)
        .limit(1)
        .single()
    : { data: null };

  // 5. Get enriched company if exists
  const { data: company } = profile?.current_company_linkedin
    ? await supabaseAdmin
        .from("enriched_companies")
        .select("*")
        .eq("linkedin_url", profile.current_company_linkedin)
        .limit(1)
        .single()
    : { data: null };

  // 6. Count enriched companies total
  const { count: companyCount } = await supabaseAdmin
    .from("enriched_companies")
    .select("id", { count: "exact", head: true });

  // 7. Build the prompt manually
  const systemPrompt = `You are a B2B lead qualifier scoring LinkedIn connections against a seller's ICP. Score 1-10. Industry is the primary gate. Respond with ONLY JSON: {"score": N, "match_type": "customer", "reasons": ["...", "...", "..."], "suggested_approach": "..."}`;

  const userMessage = `
SELLER:
Company: ${user.company_name || "Unknown"}
Website: ${user.company_website || user.website_url || "Unknown"}

ICP:
Industries: ${icpData?.industries?.join(", ") || "NONE - THIS IS THE BUG"}
Titles: ${icpData?.titles?.join(", ") || "NONE"}
Company Sizes: ${icpData?.companySizes?.join(", ") || "Any"}
Geographies: ${icpData?.geographies?.join(", ") || "Global"}
Funding Stages: ${icpData?.fundingStages?.join(", ") || "Any"}
Triggers: ${icpData?.triggers?.join(" | ") || "None"}

CONNECTION:
Name: ${testConn.first_name} ${testConn.last_name}
Title: ${testConn.position}
Company: ${testConn.company}
Seniority: ${testConn.seniority_tier}
Enriched Title: ${profile?.current_title || "N/A"}
Enriched Company: ${profile?.current_company || "N/A"}
Industry: ${profile?.industry || "N/A"}
Headline: ${profile?.headline || "N/A"}
Location: ${profile?.location_str || "N/A"}
Experience: ${profile?.total_experience_years || "N/A"} years

Company Data: ${
    company
      ? JSON.stringify({
          industry: company.industry,
          description: (company.description as string)?.slice(0, 200),
          employees:
            (company.company_size_min || "?") +
            "-" +
            (company.company_size_max || "?"),
        })
      : "NO ENRICHED COMPANY DATA - use your knowledge of " + testConn.company
  }

Score this connection.`;

  // 8. Call Haiku directly
  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawResponse =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({
      debug: {
        user_email: user.email,
        processing_status: user.processing_status,
        icp_confirmed: user.icp_confirmed,
        icp_industries: icpData?.industries,
        icp_industry_count: icpData?.industries?.length,
        icp_data_type: typeof rawIcp,
        icp_data_keys: rawIcp ? Object.keys(typeof rawIcp === "string" ? JSON.parse(rawIcp) : rawIcp) : [],
        connection_tested: `${testConn.first_name} ${testConn.last_name} @ ${testConn.company}`,
        connection_enrichment_status: testConn.enrichment_status,
        connection_enrichment_tier: testConn.enrichment_tier,
        connection_match_score: testConn.match_score,
        has_enriched_profile: !!profile,
        has_enriched_company: !!company,
        total_connections: allConns?.length || 0,
        enrichment_status_breakdown: statusBreakdown,
        enrichment_tier_breakdown: tierBreakdown,
        scored_count: scoredCount,
        total_enriched_companies: companyCount || 0,
      },
      prompt_sent: userMessage,
      haiku_response: rawResponse,
    });
  } catch (apiErr: unknown) {
    return NextResponse.json({
      error: "Haiku call failed",
      detail: apiErr instanceof Error ? apiErr.message : String(apiErr),
      debug: {
        icp_industries: icpData?.industries,
        processing_status: user.processing_status,
        enrichment_status_breakdown: statusBreakdown,
      },
    });
  }
}
