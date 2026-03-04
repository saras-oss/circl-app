import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";
import { callAnthropicWithRetry } from "@/lib/anthropic-retry";

const BATCH_SIZE = 5;

const SCORING_SYSTEM_PROMPT = `You are a B2B lead qualifier. You evaluate whether a LinkedIn connection is a valuable sales prospect for a specific business.

Think like a senior sales leader deciding: "Should I spend time reaching out to this person?"

RULES:

1. INDUSTRY IS THE PRIMARY GATE.
The seller has specified target industries. How to evaluate:

DIRECT INDUSTRY MATCH (baseline score 8-9):
The connection's company clearly operates in one of the seller's target industries.

ADJACENT INDUSTRY MATCH (baseline 7-8):
The company operates in a closely related industry. Use common sense about industry overlaps:
- Fintech <> Banking <> Payments <> Capital Markets
- HealthTech <> Healthcare <> Medical Devices <> Biotech
- SaaS <> Enterprise Software <> Cloud Infrastructure
- IT Services <> Systems Integration <> Management Consulting
If two industries share customers, talent, or technology — they're adjacent.

LOOSE THEME MATCH (baseline 5-6):
The company is in a broadly related space but not a specific or adjacent match.

NO MATCH (score 1-3):
Company industry is completely unrelated to any target industry.

Don't rely only on the industry label. The company description is more revealing. Let description override label when they conflict.

2. SENIORITY AND TITLE REFINE THE SCORE.
After industry fit, adjust based on whether this person can make or influence buying decisions:
- C-Suite (CEO, CTO, CIO, CFO, COO, CISO) in target industry: push up by 1
- VP/Head/SVP in a relevant function (Engineering, Product, Operations, IT): push up by 1
- Director in relevant function: no change
- Manager or IC: pull down by 1-2
- Title matches one of the seller's target titles EXACTLY: push up by 1

3. COMPANY SIZE ADJUSTS.
- Within target size range: no change
- One bracket away: pull down by 1
- Dramatically different: pull down by 1-2

4. GEOGRAPHY ADJUSTS.
- In target geography: no change
- Adjacent region: pull down by 1
- Completely different: pull down by 1
- Size + geography combined never swing by more than 2 total.

5. FUNDING STAGE IS A BONUS.
- Matches target funding stage (PE-backed, Public, etc.): push up by 1
- Recent funding = positive signal (company actively spending)
- No funding data = neutral, never penalize

6. TRIGGERS ARE A BONUS.
If the connection or company matches a stated trigger, push up by 1. Triggers cannot rescue a bad industry match.

7. MISSING DATA = NEUTRAL.
Never penalize absence. A strong industry match with missing size/geo can still score 7-8.

SCORE GUIDE:
10 = Perfect. Right industry + right seniority + right size + right geo + trigger match. Rare.
9 = Near-perfect. Direct industry + senior decision-maker + right size + right geo.
8 = Strong. Direct industry match + most dimensions align.
7 = Good. Direct or adjacent industry + reasonable seniority. Worth reaching out.
6 = Borderline. Theme match but not specific industry, OR industry matches but wrong seniority.
5 = Marginal. Loose industry connection.
3-4 = Weak. Industry barely related.
1-2 = No fit. Wrong industry entirely.

KEY: A 7 is someone the seller would be glad to see. A 6 is someone they'd shrug at.

REASON FORMAT:
3 bullet points. Each specific and referencing actual data.

Reason 1: ICP snapshot — weave the matching dimensions into one sentence. Include industry, company size, geography, funding if available. Example: "VP of Engineering at a 3,500-person cybersecurity firm (PE-backed) in Boston — strong fit across industry, seniority, and geography."

Reason 2: Business angle — connect what the SELLER does to what this PROSPECT's company likely needs. Be specific about why this company would buy from the seller. Reference the prospect's career stage, company phase, or recent activity.

Reason 3: Timing or additional signal — funding stage, trigger match, career trajectory, LinkedIn activity level, or any other relevant signal. If none, note the strongest additional dimension.

SUGGESTED_APPROACH: One sentence on how to reach out. Reference something specific from their profile (previous company, shared connection, recent activity).

CRITICAL:
- NEVER say "ICP is empty" — you always receive ICP criteria.
- NEVER explain what the target company does as if the seller doesn't know.
- ALWAYS surface funding stage when available — it's a timing signal.
- ALWAYS connect to what the SELLER specifically does.
- Write like a senior sales leader briefing the CEO, not a scoring algorithm.`;

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
      .select("icp_data, icp_confirmed, company_name, website_url, subscription_tier")
      .eq("id", userId)
      .single();

    const icpData = (userData?.icp_data || {}) as IcpData;
    const companyName = userData?.company_name || "Unknown";
    const websiteUrl = userData?.website_url || "";
    const subscriptionTier = userData?.subscription_tier || "free";

    // HARD GUARD: Do not score without ICP
    if (!icpData.industries || icpData.industries.length === 0) {
      return NextResponse.json({
        scored: 0,
        remaining: 0,
        hasMore: false,
        skipReason: "icp_empty",
      });
    }

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
        "linkedin_url, full_name, headline, summary, current_company, current_title, current_company_linkedin, location_str, country_full_name, total_experience_years, companies_worked_at, previous_companies, industry, is_linkedin_active, follower_count"
      )
      .in("linkedin_url", linkedinUrls);

    const profileMap = new Map(
      (profiles || []).map((p) => [p.linkedin_url, p])
    );

    // Fetch enriched companies for these profiles
    const companyLinkedInUrls = (profiles || [])
      .map((p) => p.current_company_linkedin)
      .filter(Boolean);

    const { data: companies } =
      companyLinkedInUrls.length > 0
        ? await supabaseAdmin
            .from("enriched_companies")
            .select(
              "linkedin_url, name, industry, hq_city, hq_country, company_size_min, company_size_max, company_type, latest_funding_type, latest_funding_amount, latest_funding_date, total_funding_amount, description, founded_year"
            )
            .in("linkedin_url", companyLinkedInUrls)
        : { data: [] };

    const companyMap = new Map(
      (companies || []).map((c) => [c.linkedin_url, c])
    );

    // Build structured user message with explicit ICP fields
    const connectionsText = connections
      .map((conn, i) => {
        const profile = profileMap.get(conn.linkedin_url || "");
        const company = profile?.current_company_linkedin
          ? companyMap.get(profile.current_company_linkedin)
          : null;

        let text = `--- Connection ${i + 1} (id: ${conn.id}) ---\n`;
        text += `Name: ${conn.first_name} ${conn.last_name}\n`;
        text += `Title: ${profile?.current_title || conn.position || "Unknown"}\n`;
        text += `Company: ${profile?.current_company || conn.company || "Unknown"}\n`;
        text += `Seniority: ${conn.seniority_tier || "Unknown"}\n`;
        text += `Function: ${conn.function_category || "Unknown"}\n`;
        text += `Location: ${profile?.location_str || profile?.country_full_name || "Unknown"}\n`;
        text += `Experience: ${profile?.total_experience_years || "Unknown"} years across ${profile?.companies_worked_at || "unknown number of"} companies\n`;
        text += `Previous Companies: ${(profile?.previous_companies as string[])?.join(", ") || "Unknown"}\n`;
        text += `Headline: ${profile?.headline || "Unknown"}\n`;
        text += `Summary: ${(profile?.summary as string)?.slice(0, 200) || "Not available"}\n`;
        text += `LinkedIn Active: ${profile?.is_linkedin_active ? "Yes" : "Unknown"}\n`;
        text += `Follower Count: ${profile?.follower_count || "Unknown"}\n`;

        if (company) {
          text += `\nCompany Details:\n`;
          text += `Industry: ${company.industry || "Unknown"}\n`;
          text += `Description: ${(company.description as string)?.slice(0, 200) || "Not available"}\n`;
          text += `HQ: ${company.hq_city || ""}${company.hq_city && company.hq_country ? ", " : ""}${company.hq_country || "Unknown"}\n`;
          text += `Employees: ${company.company_size_min || "?"}-${company.company_size_max || "?"}\n`;
          text += `Company Type: ${company.company_type || "Unknown"}\n`;
          text += `Funding: ${company.latest_funding_type || "Unknown"}`;
          if (company.latest_funding_amount) {
            text += ` — $${company.latest_funding_amount}`;
          }
          if (company.latest_funding_date) {
            text += ` (${company.latest_funding_date})`;
          }
          text += `\n`;
          if (company.total_funding_amount) {
            text += `Total Raised: $${company.total_funding_amount}\n`;
          }
          text += `Founded: ${company.founded_year || "Unknown"}\n`;
        }

        return text;
      })
      .join("\n");

    const userMessage = `SELLER:
Company: ${companyName}
Website: ${websiteUrl || "Not specified"}

WHAT THEY'RE LOOKING FOR:
Target Industries: ${icpData.industries?.join(", ") || "Not specified"}
Target Titles: ${icpData.titles?.join(", ") || "Not specified"}
Target Company Sizes: ${icpData.companySizes?.join(", ") || "Any"}
Target Geographies: ${icpData.geographies?.join(", ") || "Global"}
Target Funding Stages: ${icpData.fundingStages?.join(", ") || "Any"}
Sales Triggers: ${icpData.triggers?.join(" | ") || "None specified"}
Also looking for investors: ${icpData.lookingForInvestors ? "Yes" : "No"}

CONNECTIONS TO SCORE:
${connectionsText}

Score each connection. Return ONLY a valid JSON array (no other text). One object per connection in the same order:
[{"id": "<connection id>", "score": <integer 1-10>, "match_type": "<customer or investor>", "reasons": ["<reason 1>", "<reason 2>", "<reason 3>"], "suggested_approach": "<one sentence>"}, ...]`;

    const anthropic = new Anthropic();
    const startTime = Date.now();

    const aiResponse = await callAnthropicWithRetry(() =>
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: SCORING_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
      })
    );

    const durationMs = Date.now() - startTime;
    const responseText =
      aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "";

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    let scores: Array<{
      id: string;
      score: number;
      match_type: string;
      reasons: string[];
      suggested_approach: string;
    }> = [];

    try {
      scores = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      console.error(
        "Failed to parse scoring response:",
        responseText.slice(0, 500)
      );
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
          match_score: score.score,
          match_type: score.match_type,
          match_reasons: score.reasons,
          suggested_approach: score.suggested_approach,
          scored_at: new Date().toISOString(),
        })
        .eq("id", score.id);
    });

    await Promise.all(updatePromises);

    // Log to prompt_runs (matching actual table schema)
    await supabaseAdmin.from("prompt_runs").insert({
      user_id: userId,
      prompt_type: "matching",
      model: "claude-haiku-4-5-20251001",
      system_prompt: SCORING_SYSTEM_PROMPT.slice(0, 10000),
      user_prompt: userMessage.slice(0, 10000),
      response: responseText,
      structured_output: scores,
      input_tokens: aiResponse.usage?.input_tokens || 0,
      output_tokens: aiResponse.usage?.output_tokens || 0,
      duration_ms: durationMs,
      batch_id: `score-${userId}-${Date.now()}`,
      rows_processed: connections.length,
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
