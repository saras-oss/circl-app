import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";
import { callAnthropicWithRetry } from "@/lib/anthropic-retry";

const BATCH_SIZE = 5;

const SCORING_SYSTEM_PROMPT = `You are a B2B sales lead qualifier. You score how well a LinkedIn connection matches a seller's Ideal Customer Profile (ICP).

SCORING RULES:
1. INDUSTRY FIT is the primary gate (60% of score weight)
   - Use the COMPANY DESCRIPTION to determine true industry, not just the label
   - For well-known companies (Axis Bank, Kotak Mahindra, Tech Mahindra, Mimecast, JLL), use your knowledge
   - Direct industry match = high score. Adjacent match = moderate. No match = low.

2. TITLE/SENIORITY FIT (25% of score weight)
   - Does their title match the target titles in the ICP?
   - C-suite and VP at target companies = highest. Manager = moderate. IC = low.

3. GEOGRAPHY and COMPANY SIZE (15% of score weight)
   - Matching geography and company size boost the score slightly

SCORE SCALE (1-10):
10: Perfect match — right industry, right title, right company size, right geography
9: Near-perfect — one minor gap
8: Strong match — clear fit, worth pursuing
7: Good match — should be on the outreach list
6: Borderline — some fit but notable gaps
5: Weak match — significant gaps
1-4: Poor match — wrong industry or completely wrong profile

RESPOND WITH ONLY THIS JSON, nothing else:
{
  "score": <number 1-10>,
  "match_type": "<customer|partner|investor|non-target>",
  "reasons": "<Two sentences. First sentence: what matches. Second sentence: what gaps exist or why this is a strong/weak fit.>",
  "suggested_approach": "<One sentence: how should the seller approach this person, or 'Do not pursue' if score < 5>"
}`;

interface IcpData {
  industries?: string[];
  geographies?: string[];
  titles?: string[];
  companySizes?: string[];
  revenueRanges?: string[];
  fundingStages?: string[];
  triggers?: string[];
  lookingForInvestors?: boolean;
  investorFundTypes?: string[];
  investorStages?: string[];
  investorSectors?: string[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function buildScoringPrompt(
  userData: any,
  icpData: IcpData,
  conn: any,
  profile: any,
  company: any
): string {
  // Company section — use best available data
  let companySection = "";
  if (company?.description || company?.industry) {
    companySection = `
COMPANY DATA:
Name: ${company.name || conn.company}
Description: ${company.description || "Not available"}
Industry Label: ${company.industry || "Unknown"}
Specialities: ${company.specialities ? JSON.stringify(company.specialities) : "N/A"}
Website: ${company.website || "Unknown"}
Size: ${company.company_size_min && company.company_size_max ? company.company_size_min + "-" + company.company_size_max + " employees" : "Unknown"}
HQ: ${[company.hq_city, company.hq_country].filter(Boolean).join(", ") || "Unknown"}
Type: ${company.company_type || "Unknown"}`;
  } else {
    companySection = `
COMPANY DATA:
Name: ${conn.company}
(No enriched company data available — use your knowledge of "${conn.company}" to assess industry fit)`;
  }

  // Person section
  const personSection = `
PERSON:
Name: ${conn.first_name} ${conn.last_name}
Title: ${profile?.current_title || conn.position}
Headline: ${profile?.headline || "N/A"}
Summary: ${profile?.summary ? (profile.summary as string).slice(0, 300) : "N/A"}
Seniority: ${conn.seniority_tier || "Unknown"}
Location: ${profile?.location_str || "Unknown"}
Experience: ${profile?.total_experience_years || "Unknown"} years
Industry (from profile): ${profile?.industry || "Not specified"}`;

  return `
SELLER: ${userData.company_name || "Unknown"} (${userData.website_url || "Unknown"})

ICP (Ideal Customer Profile):
Target Industries: ${icpData.industries?.join(", ") || "Not specified"}
Target Titles: ${icpData.titles?.join(", ") || "Not specified"}
Target Company Sizes: ${icpData.companySizes?.join(", ") || "Any"}
Target Geographies: ${icpData.geographies?.join(", ") || "Global"}
Target Funding Stages: ${icpData.fundingStages?.join(", ") || "Any"}
Sales Triggers: ${icpData.triggers?.join(" | ") || "None specified"}

${personSection}

${companySection}

Score this connection against the ICP.`;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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
      .select("icp_data, icp_confirmed, company_name, website_url")
      .eq("id", userId)
      .single();

    // Safety parse: handle icp_data as string or object
    const rawIcp = userData?.icp_data;
    const icpData = (
      typeof rawIcp === "string" ? JSON.parse(rawIcp) : rawIcp || {}
    ) as IcpData;

    // HARD GUARD: Do not score without ICP
    if (!icpData.industries || icpData.industries.length === 0) {
      console.log("SCORE: ICP guard triggered — no industries found.", {
        userId,
        icpDataType: typeof rawIcp,
        icpDataKeys: rawIcp
          ? Object.keys(typeof rawIcp === "string" ? JSON.parse(rawIcp) : rawIcp)
          : [],
        icp_confirmed: userData?.icp_confirmed,
      });
      return NextResponse.json({
        scored: 0,
        remaining: 0,
        hasMore: false,
        skipReason: "icp_empty",
      });
    }

    console.log(
      "SCORE: ICP industries:",
      icpData.industries?.length,
      "confirmed:",
      userData?.icp_confirmed
    );

    // Find unscored enriched connections — NO OTHER FILTERS
    const { data: connections, error: fetchError } = await supabaseAdmin
      .from("user_connections")
      .select("*")
      .eq("user_id", userId)
      .in("enrichment_status", ["enriched", "cached"])
      .is("match_score", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    console.log(
      `SCORE: Found ${connections?.length || 0} unscored connections`
    );

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({ scored: 0, remaining: 0, hasMore: false });
    }

    const anthropic = new Anthropic();
    let scoredCount = 0;

    // Score ONE connection at a time
    for (const conn of connections) {
      // Get enriched profile
      const { data: profile } = conn.linkedin_url
        ? await supabaseAdmin
            .from("enriched_profiles")
            .select(
              "headline, current_title, current_company, industry, summary, location_str, total_experience_years, current_company_linkedin"
            )
            .eq("linkedin_url", conn.linkedin_url)
            .limit(1)
            .single()
        : { data: null };

      // Get enriched company (if exists)
      let company = null;
      if (profile?.current_company_linkedin) {
        const { data: companyData } = await supabaseAdmin
          .from("enriched_companies")
          .select(
            "name, description, industry, specialities, website, company_size_min, company_size_max, company_type, hq_city, hq_country, founded_year, tagline"
          )
          .eq("linkedin_url", profile.current_company_linkedin)
          .limit(1)
          .single();
        company = companyData;
      }

      // Build prompt
      const scoringPrompt = buildScoringPrompt(
        userData,
        icpData,
        conn,
        profile,
        company
      );

      try {
        const startTime = Date.now();

        const aiResponse = await callAnthropicWithRetry(() =>
          anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 400,
            system: SCORING_SYSTEM_PROMPT,
            messages: [{ role: "user", content: scoringPrompt }],
          })
        );

        const durationMs = Date.now() - startTime;
        const rawText =
          aiResponse.content[0].type === "text"
            ? aiResponse.content[0].text
            : "";

        // Parse the JSON response
        let scoreResult: {
          score: number;
          match_type: string;
          reasons: string;
          suggested_approach: string;
        };
        try {
          const cleaned = rawText
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();
          scoreResult = JSON.parse(cleaned);
        } catch {
          console.error(
            `SCORE: Failed to parse Haiku response for ${conn.first_name}:`,
            rawText.slice(0, 500)
          );
          continue; // Skip this connection, try next
        }

        // Save to DB
        const { error: updateError } = await supabaseAdmin
          .from("user_connections")
          .update({
            match_score: scoreResult.score,
            match_type: scoreResult.match_type,
            match_reasons: Array.isArray(scoreResult.reasons)
              ? scoreResult.reasons
              : [scoreResult.reasons],
            suggested_approach: scoreResult.suggested_approach,
            scored_at: new Date().toISOString(),
          })
          .eq("id", conn.id);

        if (updateError) {
          console.error(
            `SCORE: DB update failed for ${conn.first_name}:`,
            updateError.message
          );
          continue;
        }

        scoredCount++;
        console.log(
          `SCORE: ${conn.first_name} ${conn.last_name} @ ${conn.company} → ${scoreResult.score}/10`
        );

        // Log to prompt_runs
        await supabaseAdmin.from("prompt_runs").insert({
          user_id: userId,
          prompt_type: "scoring",
          model: "claude-haiku-4-5-20251001",
          system_prompt: SCORING_SYSTEM_PROMPT.slice(0, 10000),
          user_prompt: scoringPrompt.slice(0, 10000),
          response: rawText,
          structured_output: scoreResult,
          input_tokens: aiResponse.usage?.input_tokens || 0,
          output_tokens: aiResponse.usage?.output_tokens || 0,
          duration_ms: durationMs,
          batch_id: `score-${userId}-${Date.now()}`,
          rows_processed: 1,
        });
      } catch (err) {
        console.error(
          `SCORE: LLM call failed for ${conn.first_name}:`,
          err instanceof Error ? err.message : err
        );
        continue; // Skip this connection, try next
      }
    }

    // Count remaining unscored
    const { count: remaining } = await supabaseAdmin
      .from("user_connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("enrichment_status", ["enriched", "cached"])
      .is("match_score", null);

    return NextResponse.json({
      scored: scoredCount,
      remaining: remaining || 0,
      hasMore: (remaining || 0) > 0,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
