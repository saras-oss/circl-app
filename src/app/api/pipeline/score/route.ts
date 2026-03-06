import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";
import { callAnthropicWithRetry } from "@/lib/anthropic-retry";
import { serializeFunctionsForPrompt } from "@/lib/taxonomy/functions";

const BATCH_SIZE = 25;
const PARALLEL_LIMIT = 10;

const SCORING_SYSTEM_PROMPT = `You are a B2B lead qualifier for a LinkedIn network scoring tool. You evaluate whether a LinkedIn connection is a valuable sales prospect for a specific business.

Think like a senior sales leader deciding: "Should we spend time reaching out to this person?"

RULES:

1. INDUSTRY IS THE PRIMARY GATE.
The seller has specified target industries. How to evaluate the connection's COMPANY against those targets:

DIRECT INDUSTRY MATCH (baseline score 8-9):
The connection's company clearly operates in one of the seller's target industries. The seller targets "SaaS" and the prospect's company IS a SaaS company. The seller targets "Fintech" and the company is a fintech company. This is the strongest signal.

ADJACENT INDUSTRY MATCH (baseline 7-8):
The company operates in a closely related industry. Use your knowledge of how industries overlap:
- Fintech ↔ Banking ↔ Payments ↔ Capital Markets ↔ Lending
- HealthTech ↔ Hospital & Healthcare ↔ Medical Devices ↔ Digital Health ↔ Biotech
- SaaS ↔ Enterprise Software ↔ Developer Tools ↔ Cloud Infrastructure
- EdTech ↔ E-Learning ↔ Higher Education
- IT Services ↔ IT Outsourcing ↔ Systems Integration ↔ Management Consulting
- HR & Recruiting ↔ Staffing & Workforce Solutions
- E-commerce ↔ Marketplace ↔ D2C Brands ↔ Retail
- CleanTech ↔ Energy ↔ Renewables
- PropTech ↔ Real Estate ↔ Commercial Real Estate ↔ Construction
- AdTech / MarTech ↔ Marketing & Advertising ↔ Media & Publishing
- Cybersecurity ↔ Computer & Network Security ↔ Data & Analytics
- Logistics & Supply Chain ↔ Warehousing ↔ Transportation ↔ Manufacturing
- Automotive ↔ Electric Vehicles ↔ Mobility
This is NOT exhaustive — use common sense. If two industries share customers, talent, or technology, they are adjacent.

THEME-LEVEL MATCH (baseline 5-6):
The company is in a broadly related space but doesn't match any specific or adjacent target industry. Example: seller targets "SaaS" and "AI/ML", prospect company is a gaming company. They're in tech, but gaming isn't adjacent to SaaS or AI/ML.

NO MATCH (score 1-3):
Company industry is completely unrelated to any target. A restaurant chain when the seller targets financial services. A farming company when the seller targets technology.

Don't rely only on the industry label. The company description is more revealing. A company labeled "Information Technology & Services" might be a pure SaaS product. A company labeled "Financial Services" might be a fintech startup building payment APIs. Let the description override the label when they conflict.

For well-known companies, use your knowledge. You know what Mimecast, Deloitte, Axis Bank, Google, and Salesforce do — don't pretend otherwise.

The key question: "If I told the seller about this company, would they say 'yes, that's the kind of company I sell to'?"

2. FUNCTION AND SENIORITY REFINE THE SCORE.
The seller has specified Target Functions (e.g., "Engineering & Technology", "Finance") and optionally specific Target Titles within those functions.

The connection has a Function field (e.g., "Engineering & Technology") assigned during classification. Compare:

- Connection's Function matches a Target Function + C-Suite seniority → push up by 2
- Connection's Function matches a Target Function + VP/Director seniority → push up by 1
- Connection's Function matches a Target Function + Manager seniority → no change
- Connection's Function matches a Target Function + IC seniority → pull down by 1
- Connection's Function does NOT match any Target Function → pull down by 1-2
- If specific Target Titles are listed and this person's title is an EXACT match → additional push up by 1

The function match is more important than exact title matching. "Head of Data Infrastructure" with function "Engineering & Technology" matches a target function of "Engineering & Technology" even though the title isn't "CTO" or "VP Engineering."

3. COMPANY SIZE AND GEOGRAPHY ADJUST.
- Within target size range → no change
- One bracket away → pull down by 1 at most
- Dramatically different → pull down by 1-2
- In target geography → no change
- Adjacent region → pull down by 1 at most
- Completely different region → pull down by 1
- Size + geography combined never swing by more than 2 total.

4. FUNDING STAGE IS A POSITIVE-ONLY BOOSTER.
- Recent funding (Seed, Series A/B/C, PE round) = positive signal, +1 max. Recently funded companies are hiring and expanding.
- No funding data / bootstrapped / anything else = neutral. NEVER penalize.
- Funding alone cannot make a bad industry match good.

5. TRIGGERS ARE A BONUS.
If the connection or company matches a stated trigger, push score up by 1. Triggers cannot rescue a bad industry match.

6. MISSING DATA = NEUTRAL.
If a field is unknown or unavailable, skip that dimension. Don't penalize, don't guess. A strong industry match with missing size/geo can still score 7-8.

SCORE GUIDE:
10 = Perfect. Right industry + right seniority + right size + right geo + clear need + trigger. Rare.
9 = Near-perfect. Right industry + senior decision-maker + right size + right geo.
8 = Strong fit. Industry match + most dimensions align. Seller should see this person.
7 = Good fit. Industry or strong adjacent match + reasonable seniority. Worth reaching out.
6 = Borderline. Theme match but not specific industry, OR industry matches but wrong seniority/size.
5 = Marginal. Loose industry connection or wrong seniority level.
4 = Weak. Stretch connection to target industries.
3 = Poor. Industry barely related.
1-2 = No fit. Wrong industry entirely.

THE KEY DISTINCTION: A 7 is someone the seller would be glad to see. A 6 is someone they'd shrug at. When in doubt between 6 and 7, ask: "Would a busy founder be glad they saw this, or annoyed?"

RESPOND WITH ONLY THIS JSON, nothing else:
{"score": <integer 1-10>, "match_type": "<customer|investor|partner|non-target>", "reasons": "<reason text>", "suggested_approach": "<one sentence>"}

MATCH TYPE:
- "customer": This person works at a company that could BUY from the seller
- "investor": This person is at a VC, PE firm, or investment entity AND the seller is looking for investors
- "partner": This person is at a company that could be a strategic partner (consulting, agency, complementary product)
- "non-target": Doesn't fit any category

REASON FORMAT — This is what the seller reads. Make every word count.

Structure: Exactly 2 sentences, under 50 words total.

SENTENCE 1 — THE ICP SNAPSHOT
Open with the key ICP dimensions that matched, woven naturally. The seller should instantly see WHY this person appeared in their matches.

Include whichever are relevant:
- The person's role and seniority ("VP of Engineering", "CEO", "Director of Operations")
- Company industry descriptor ("SaaS platform", "cybersecurity firm", "PE-backed IT consultancy")
- Company size ("3,500 employees", "mid-market")
- Geography ("US-based", "London-headquartered")
- Funding signal ("Series B", "recently PE-backed") — this is a TIMING indicator

Pattern: "{Role} at a {size} {industry} {company descriptor}, {geography} — {natural summary of fit}."

Good examples:
- "VP of Engineering at a Series B SaaS company, 129 employees in New York — strong fit across industry, seniority, size, and geography."
- "CEO of a PE-backed IT consulting firm with 636 employees across Europe — aligns with target industry, decision-maker seniority, and size."
- "Director of Operations at a 2,400-person cybersecurity platform in London — fits target industry and geography with relevant operational role."

Bad examples (DO NOT write like these):
- "Sagnik Bhattacharya is the CEO of Rhapsody, a company in the technology space." (Describes the person — seller can already see this on the card.)
- "Matches Technology & Software sub-industry targets with right size." (Sounds like a scoring algorithm, not a sales leader.)
- "Strong fit for the seller's ICP criteria across multiple dimensions." (Empty. Says nothing specific.)

SENTENCE 2 — THE BUSINESS ANGLE
Connect what the SELLER does to why this PROSPECT's company would need it. Be specific.

Think about:
- What does the seller's company actually do? (Read their description carefully)
- What would this prospect's company need from the seller?
- Is there a timing signal? (Recent funding = actively spending. Scaling = needs infrastructure. Expanding internationally = needs local operations.)

Good examples:
- "Post-Series A growth means they're actively building engineering teams — prime timing for India-based talent operations."
- "As a large European IT firm expanding delivery capabilities, they have the complexity and budget for dedicated India team partnerships."
- "At 22 employees with recent seed funding, they're early but scaling fast — a pipeline opportunity as headcount grows."

Bad examples (DO NOT write like these):
- "They need specialized services to support their scaling operations." (What services? Why now? "Specialized services" means nothing.)
- "A strong match for the seller's target sectors." (Just restates sentence 1.)
- "Their technology platform and distributed operations create opportunities." (Vague. What opportunities? For what?)

SUGGESTED APPROACH — One sentence. How should the seller reach out to this specific person?
Reference something concrete: their role, a previous company, their LinkedIn activity, mutual context. If score < 5, say "Low priority — does not match core ICP."

Good: "Reference his experience scaling engineering at UKG when discussing your GCC capabilities."
Good: "Connect over shared fintech industry context — she's likely evaluating offshore talent solutions post-Series B."
Bad: "Reach out via LinkedIn." (Obvious and useless.)

CRITICAL RULES:
1. NEVER explain what the target company does as if the seller doesn't know. The company card already shows this.
2. ALWAYS surface funding stage when available — it's a timing signal.
3. ALWAYS connect to what the SELLER specifically does. Read their company description.
4. BE HONEST about timing. Don't manufacture urgency. If it's a pipeline opportunity, say so.
5. NEVER use: "specialized services", "direct match for target sectors", "scaling operations" (without specificity), "service partners". These are empty calories.
6. Write like a senior sales leader briefing the CEO, not a scoring algorithm.`;

interface IcpData {
  industries?: string[];
  geographies?: string[];
  functions?: string[];
  titles?: string[];
  companySizes?: string[];
  revenueRanges?: string[];
  fundingStages?: string[];
  triggers?: string[];
  lookingForInvestors?: boolean;
  investorFundTypes?: string[];
  investorStages?: string[];
  investorSectors?: string[];
  companyDescription?: string;
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
  let companySection: string;
  if (company?.description || company?.industry) {
    companySection = `COMPANY DATA:
Name: ${company.name || conn.company || "Unknown"}
Description: ${company.description || "Not available"}
Industry Label: ${company.industry || "Unknown"}
Specialities: ${company.specialities ? JSON.stringify(company.specialities) : "Unknown"}
Website: ${company.website || "Unknown"}
Size: ${company.company_size_min || "?"}-${company.company_size_max || "?"} employees
HQ: ${[company.hq_city, company.hq_country].filter(Boolean).join(", ") || "Unknown"}
Type: ${company.company_type || "Unknown"}
Funding: ${company.latest_funding_type || "Unknown"} — $${company.latest_funding_amount || "?"} (${company.latest_funding_date || "date unknown"})
Total Raised: $${company.total_funding_amount || "Unknown"}
Founded: ${company.founded_year || "Unknown"}`;
  } else {
    companySection = `COMPANY DATA:
Name: ${conn.company || "Unknown"}
(No enriched company data available — use your knowledge of "${conn.company}" to assess industry fit if it's a well-known company.)`;
  }

  return `SELLER:
Company: ${userData.company_name || "Not specified"}
Website: ${userData.company_website || "Not specified"}
What they do: ${icpData?.companyDescription || "Not specified"}

WHAT THEY'RE LOOKING FOR:
Target Industries: ${icpData.industries?.join(", ") || "Not specified"}
Target Functions: ${serializeFunctionsForPrompt(icpData.functions || [], icpData.titles)}
Target Titles (specific): ${icpData.titles?.join(", ") || "All senior roles in target functions"}
Target Company Sizes: ${icpData.companySizes?.join(", ") || "Any"}
Target Geographies: ${icpData.geographies?.join(", ") || "Global"}
Target Funding Stages: ${icpData.fundingStages?.join(", ") || "Any"}
Sales Triggers: ${icpData.triggers?.join(" | ") || "None specified"}
Looking for investors: ${icpData.lookingForInvestors ? "Yes" : "No"}

CONNECTION TO SCORE:
Name: ${conn.first_name} ${conn.last_name}
Title: ${profile?.current_title || conn.position || "Unknown"}
Headline: ${profile?.headline || "Unknown"}
Summary: ${profile?.summary ? (profile.summary as string).slice(0, 300) : "Not available"}
Seniority: ${conn.seniority_tier || "Unknown"}
Function: ${conn.function_category || "Unknown"}
Location: ${profile?.location_str || profile?.country_full_name || "Unknown"}
Experience: ${profile?.total_experience_years || "Unknown"} years
Previous Companies: ${profile?.previous_companies ? (Array.isArray(profile.previous_companies) ? profile.previous_companies.join(", ") : profile.previous_companies) : "Unknown"}
LinkedIn Active: ${profile?.is_linkedin_active ? "Yes" : "Unknown"}
Industry (from profile): ${profile?.industry || "Unknown"}

${companySection}

Score this connection against the ICP.`;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function POST(request: Request) {
  try {
    // Read body first (can only be read once)
    const body = await request.json();
    const { userId } = body;

    // Auth: session-based (browser orchestrator) OR cron-secret (background worker)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const cronSecret = request.headers.get("x-cron-secret");
    const isCronCall =
      cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;

    if (user?.id) {
      if (userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!isCronCall || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's ICP data + company info
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, icp_data, icp_confirmed, company_name, company_website")
      .eq("id", userId)
      .single();

    console.log("SCORE: Raw user query result:", {
      hasData: !!userData,
      error: userError?.message,
      dataKeys: userData ? Object.keys(userData) : [],
      icp_data_type: typeof userData?.icp_data,
      icp_confirmed: userData?.icp_confirmed,
    });

    if (userError || !userData) {
      console.error("SCORE: Failed to fetch user:", userError?.message);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Safety parse — icp_data might be string or object
    const icpData = (
      typeof userData.icp_data === "string"
        ? JSON.parse(userData.icp_data)
        : userData.icp_data
    ) as IcpData | null;

    console.log("SCORE: User loaded", {
      userId,
      hasIcpData: !!icpData,
      icpDataType: typeof icpData,
      industries: icpData?.industries?.length || 0,
      icp_confirmed: userData.icp_confirmed,
    });

    // HARD GUARD: Do not score without ICP
    if (!icpData?.industries || icpData.industries.length === 0) {
      console.log("SCORE: ICP guard triggered — no industries found.");
      return NextResponse.json({
        scored: 0,
        remaining: 0,
        hasMore: false,
        skipReason: "icp_empty",
      });
    }

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

    // Score a single connection — returns true if scored successfully
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function scoreOne(conn: any): Promise<boolean> {
      // Get enriched profile
      const { data: profile } = conn.linkedin_url
        ? await supabaseAdmin
            .from("enriched_profiles")
            .select(
              "headline, current_title, current_company, industry, summary, location_str, country_full_name, total_experience_years, previous_companies, is_linkedin_active, current_company_linkedin"
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
            "name, description, industry, specialities, website, company_size_min, company_size_max, company_type, hq_city, hq_country, founded_year, tagline, latest_funding_type, latest_funding_amount, latest_funding_date, total_funding_amount"
          )
          .eq("linkedin_url", profile.current_company_linkedin)
          .limit(1)
          .single();
        company = companyData;
      }

      // Build prompt
      const scoringPrompt = buildScoringPrompt(
        userData,
        icpData!,
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
          return false;
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

        // If match_type constraint fails, retry without it
        if (updateError) {
          console.error(
            `SCORE: DB update failed for ${conn.first_name}, retrying without match_type:`,
            updateError.message
          );

          const { error: retryError } = await supabaseAdmin
            .from("user_connections")
            .update({
              match_score: scoreResult.score,
              match_type: null,
              match_reasons: Array.isArray(scoreResult.reasons)
                ? scoreResult.reasons
                : [scoreResult.reasons],
              suggested_approach: scoreResult.suggested_approach,
              scored_at: new Date().toISOString(),
            })
            .eq("id", conn.id);

          if (retryError) {
            console.error(
              `SCORE: Retry also failed for ${conn.first_name}:`,
              retryError.message
            );
            // Mark as failed so we don't retry forever
            await supabaseAdmin
              .from("user_connections")
              .update({
                match_score: -1,
                scored_at: new Date().toISOString(),
              })
              .eq("id", conn.id);
            return false;
          }
        }

        console.log(
          `SCORE: ${conn.first_name} ${conn.last_name} @ ${conn.company} → ${scoreResult.score}/10`
        );

        // Log to prompt_runs
        const { error: logError } = await supabaseAdmin.from("prompt_runs").insert({
          user_id: userId,
          prompt_type: "scoring",
          model: "claude-haiku-4-5-20251001",
          system_prompt: SCORING_SYSTEM_PROMPT.slice(0, 10000),
          user_prompt: scoringPrompt.slice(0, 10000),
          response: rawText,
          structured_output: JSON.stringify(scoreResult),
          input_tokens: aiResponse.usage?.input_tokens || 0,
          output_tokens: aiResponse.usage?.output_tokens || 0,
          duration_ms: durationMs,
          batch_id: `score-${userId}-${Date.now()}`,
          rows_processed: 1,
        });
        if (logError) {
          console.error(`SCORE: prompt_runs insert failed for ${conn.first_name}:`, logError.message);
        }

        return true;
      } catch (err) {
        console.error(
          `SCORE: LLM call failed for ${conn.first_name}:`,
          err instanceof Error ? err.message : err
        );
        return false;
      }
    }

    // Process connections in parallel waves of PARALLEL_LIMIT
    for (let i = 0; i < connections.length; i += PARALLEL_LIMIT) {
      const batch = connections.slice(i, i + PARALLEL_LIMIT);
      const results = await Promise.allSettled(batch.map((conn) => scoreOne(conn)));
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          scoredCount++;
        }
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
