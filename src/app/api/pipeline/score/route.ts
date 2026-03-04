import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

const BATCH_SIZE = 5;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await request.json();

    if (userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get user's ICP data + company info
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("icp_data, company_name, website_url, subscription_tier")
      .eq("id", userId)
      .single();

    const icpData = userData?.icp_data || {};
    const companyName = userData?.company_name || "Unknown";
    const websiteUrl = userData?.website_url || "";
    const subscriptionTier = userData?.subscription_tier || "free";

    // Find unscored enriched connections (tier1+tier2)
    let query = supabaseAdmin
      .from("user_connections")
      .select(
        "id, first_name, last_name, company, position, linkedin_url, seniority_tier, function_category, connection_type_signal, connected_on"
      )
      .eq("user_id", userId)
      .is("match_score", null)
      .in("enrichment_status", ["enriched", "cached"])
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (subscriptionTier === "free") {
      query = query.eq("is_free_tier_selection", true);
    } else {
      query = query.in("enrichment_tier", ["tier1", "tier2"]);
    }

    const { data: connections, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        scored: 0,
        remaining: 0,
        hasMore: false,
      });
    }

    // Fetch enriched profiles for these connections
    const linkedinUrls = connections
      .map((c) => c.linkedin_url)
      .filter(Boolean);

    const { data: profiles } = await supabaseAdmin
      .from("enriched_profiles")
      .select(
        "linkedin_url, full_name, headline, summary, current_company, current_title, current_company_linkedin, location_str, country_full_name, total_experience_years, companies_worked_at, previous_companies, industry"
      )
      .in("linkedin_url", linkedinUrls);

    const profileMap = new Map(
      (profiles || []).map((p) => [p.linkedin_url, p])
    );

    // Fetch enriched companies for these profiles
    const companyLinkedInUrls = (profiles || [])
      .map((p) => p.current_company_linkedin)
      .filter(Boolean);

    const { data: companies } = companyLinkedInUrls.length > 0
      ? await supabaseAdmin
          .from("enriched_companies")
          .select(
            "linkedin_url, name, industry, hq_city, hq_country, company_size_min, company_size_max, company_type, latest_funding_type, latest_funding_amount, latest_funding_date, total_funding_amount, description"
          )
          .in("linkedin_url", companyLinkedInUrls)
      : { data: [] };

    const companyMap = new Map(
      (companies || []).map((c) => [c.linkedin_url, c])
    );

    // Build scoring prompt with all connections
    const connectionsText = connections
      .map((conn, i) => {
        const profile = profileMap.get(conn.linkedin_url || "");
        const company = profile?.current_company_linkedin
          ? companyMap.get(profile.current_company_linkedin)
          : null;

        let text = `--- CONNECTION ${i + 1} (id: ${conn.id}) ---\n`;
        text += `Name: ${conn.first_name} ${conn.last_name}\n`;
        text += `Title: ${profile?.current_title || conn.position || "N/A"}\n`;
        text += `Company: ${profile?.current_company || conn.company || "N/A"}\n`;
        text += `Seniority: ${conn.seniority_tier || "N/A"}\n`;
        text += `Function: ${conn.function_category || "N/A"}\n`;
        text += `Location: ${profile?.location_str || "N/A"}, ${profile?.country_full_name || "N/A"}\n`;
        text += `Experience: ${profile?.total_experience_years || "N/A"} years across ${profile?.companies_worked_at || "N/A"} companies\n`;
        text += `Previous companies: ${(profile?.previous_companies as string[])?.join(", ") || "N/A"}\n`;
        text += `Headline: ${profile?.headline || "N/A"}\n`;
        text += `Summary: ${(profile?.summary as string)?.slice(0, 200) || "N/A"}\n`;
        text += `Connection type signal: ${conn.connection_type_signal || "N/A"}\n`;

        if (company) {
          text += `\nCOMPANY DATA:\n`;
          text += `Industry: ${company.industry || "N/A"}\n`;
          text += `HQ: ${company.hq_city || "N/A"}, ${company.hq_country || "N/A"}\n`;
          text += `Employees: ${company.company_size_min || "?"}-${company.company_size_max || "?"}\n`;
          text += `Type: ${company.company_type || "N/A"}\n`;
          if (company.latest_funding_type) {
            text += `Funding: ${company.latest_funding_type} — $${company.latest_funding_amount || "?"} (${company.latest_funding_date || "N/A"})\n`;
            text += `Total raised: $${company.total_funding_amount || "?"}\n`;
          }
          text += `Description: ${(company.description as string)?.slice(0, 200) || "N/A"}\n`;
        }

        return text;
      })
      .join("\n");

    const anthropic = new Anthropic();
    const startTime = Date.now();

    const aiResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are a B2B sales intelligence scoring engine. Score each connection against the user's ICP.

USER'S ICP:
${JSON.stringify(icpData, null, 2)}

USER'S COMPANY: ${companyName} (${websiteUrl})

CONNECTIONS TO SCORE:
${connectionsText}

For EACH connection, respond with ONLY a valid JSON array (no other text). One object per connection in the same order:
[
  {
    "id": "<connection id>",
    "match_score": <number 0-100>,
    "match_type": <"customer" | "investor">,
    "reasons": ["<reason 1>", "<reason 2>", "<reason 3>"],
    "suggested_approach": "<one sentence>"
  },
  ...
]

SCORING GUIDELINES:
- 85-100: Perfect ICP match. Right seniority + right industry + right company size + active trigger
- 70-84: Strong match. Most ICP criteria met
- 50-69: Moderate match. Some criteria met
- 30-49: Weak match. Few criteria met
- 0-29: Poor match

Be specific in reasons. Reference actual data points (company name, funding, employee count, etc).`,
        },
      ],
    });

    const durationMs = Date.now() - startTime;
    const responseText =
      aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "";

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    let scores: Array<{
      id: string;
      match_score: number;
      match_type: string;
      reasons: string[];
      suggested_approach: string;
    }> = [];

    try {
      scores = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      console.error("Failed to parse scoring response:", responseText.slice(0, 500));
      return NextResponse.json(
        { error: "Failed to parse scoring response" },
        { status: 500 }
      );
    }

    // Save scores to user_connections
    const updatePromises = scores.map((score) => {
      return supabaseAdmin
        .from("user_connections")
        .update({
          match_score: score.match_score,
          match_type: score.match_type,
          match_reasons: score.reasons,
          suggested_approach: score.suggested_approach,
          scored_at: new Date().toISOString(),
        })
        .eq("id", score.id);
    });

    await Promise.all(updatePromises);

    // Log to prompt_runs
    await supabaseAdmin.from("prompt_runs").insert({
      user_id: userId,
      prompt_type: "scoring",
      model: "claude-haiku-4-5-20251001",
      input_tokens: aiResponse.usage?.input_tokens || 0,
      output_tokens: aiResponse.usage?.output_tokens || 0,
      duration_ms: durationMs,
      rows_processed: connections.length,
      status: "completed",
    });

    // Count remaining unscored
    let remainingQuery = supabaseAdmin
      .from("user_connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("match_score", null)
      .in("enrichment_status", ["enriched", "cached"]);

    if (subscriptionTier === "free") {
      remainingQuery = remainingQuery.eq("is_free_tier_selection", true);
    } else {
      remainingQuery = remainingQuery.in("enrichment_tier", ["tier1", "tier2"]);
    }

    const { count: remaining } = await remainingQuery;

    return NextResponse.json({
      scored: scores.length,
      remaining: remaining || 0,
      hasMore: (remaining || 0) > 0,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
