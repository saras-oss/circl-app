/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";
import { callAnthropicWithRetry } from "@/lib/anthropic-retry";

// ── Theme computation ──

interface ThemeResult {
  id: string;
  title: string;
  score: number;
  data: any;
  promptContext: string;
}

function computeFoundersAtFundedCompanies(connections: any[]): ThemeResult {
  const founders = connections.filter((c) => {
    const title = (c.current_title || c.csv_position || "").toLowerCase();
    const isFounder =
      title.includes("founder") ||
      title.includes("ceo") ||
      title.includes("co-founder") ||
      title.includes("cofounder");
    const isFunded = c.latest_funding_type && c.latest_funding_type !== "";
    return isFounder && isFunded;
  });

  const details = founders.map((c) => ({
    name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
    title: c.current_title || c.csv_position || "",
    company: c.current_company || c.csv_company || "",
    industry: c.company_industry || "",
    funding_type: c.latest_funding_type || "",
    funding_amount: c.latest_funding_amount || null,
    total_raised: c.total_funding_amount || null,
    company_size:
      c.company_size_min && c.company_size_max
        ? `${c.company_size_min}-${c.company_size_max}`
        : "",
    score: c.match_score,
    connected_on: c.connected_on || "",
  }));

  return {
    id: "founders_funded",
    title: "Founders at Funded Companies",
    score: founders.length >= 3 ? founders.length * 3 : founders.length,
    data: details,
    promptContext: `THEME: Founders & CEOs at Funded Companies

You found ${founders.length} founders/CEOs in this network who are at companies that have raised funding. These are decision-makers with budget — they control spending and can green-light vendor purchases.

Data:
${JSON.stringify(details, null, 0)}

Write a compelling insight about these founders. For each person, mention their name, title, company, what funding they raised (type + amount if available), and why this matters for outreach timing. Highlight which ones are at the BEST companies (ICP fit, recent funding, right size). If any raised funding recently, emphasize the timing urgency — funded companies spend within 6-12 months of raising.`,
  };
}

function computeCareerMovers(connections: any[]): ThemeResult {
  const movers: any[] = [];

  for (const c of connections) {
    let workHistory: any[] = [];
    try {
      workHistory =
        typeof c.work_history === "string"
          ? JSON.parse(c.work_history)
          : Array.isArray(c.work_history)
            ? c.work_history
            : [];
    } catch {
      continue;
    }

    if (workHistory.length < 2) continue;

    const currentRole = workHistory[0];
    const startYear = currentRole?.starts_at?.year;
    const startMonth = currentRole?.starts_at?.month || 1;

    if (!startYear) continue;

    const startDate = new Date(startYear, startMonth - 1);
    const monthsInRole =
      (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

    if (monthsInRole <= 12) {
      const previousRole = workHistory[1];
      movers.push({
        name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
        current_title: c.current_title || currentRole?.title || "",
        current_company: c.current_company || currentRole?.company || "",
        previous_title: previousRole?.title || "",
        previous_company: previousRole?.company || "",
        started_current: `${startYear}-${String(startMonth).padStart(2, "0")}`,
        months_in_role: Math.round(monthsInRole),
        industry: c.company_industry || "",
        seniority: c.seniority_tier || "",
        score: c.match_score,
        funding_type: c.latest_funding_type || "",
        company_size:
          c.company_size_min && c.company_size_max
            ? `${c.company_size_min}-${c.company_size_max}`
            : "",
      });
    }
  }

  return {
    id: "career_movers",
    title: "Career Movers",
    score: movers.length >= 2 ? movers.length * 4 : movers.length,
    data: movers,
    promptContext: `THEME: Recent Career Movers — New Roles in the Last 12 Months

You found ${movers.length} connections who started a NEW role in the last 12 months. This is a golden outreach window — new leaders are:
- Evaluating their tech stack and vendor relationships
- Building their team and processes from scratch
- Open to meetings because they're in "learning mode"
- Often have new budget to deploy

Data:
${JSON.stringify(movers, null, 0)}

Write a compelling insight about these career movers. For each, mention their name, what they moved FROM (previous title + company) and TO (current title + company), when they started, and why this creates an opportunity. Prioritize senior movers (VP+, C-suite) at ICP-fit companies. Emphasize the timing angle — someone 3 months into a new VP role is MORE receptive than someone 3 years in.`,
  };
}

function computeDormantGold(connections: any[]): ThemeResult {
  const now = new Date();
  const twoYearsAgo = new Date(
    now.getFullYear() - 2,
    now.getMonth(),
    now.getDate()
  );

  const dormant = connections.filter((c) => {
    if (!c.connected_on) return false;
    const connDate = new Date(c.connected_on);
    const isOld = connDate < twoYearsAgo;
    const isSenior =
      c.seniority_tier === "C-suite" || c.seniority_tier === "VP/Director";
    const isHighScore = c.match_score && c.match_score >= 7;
    return isOld && (isSenior || isHighScore);
  });

  const details = dormant
    .map((c) => {
      const connDate = new Date(c.connected_on);
      const yearsConnected = Math.round(
        (now.getTime() - connDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
      );
      return {
        name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
        title: c.current_title || c.csv_position || "",
        company: c.current_company || c.csv_company || "",
        industry: c.company_industry || "",
        seniority: c.seniority_tier || "",
        score: c.match_score,
        connected_on: c.connected_on,
        years_connected: yearsConnected,
        funding_type: c.latest_funding_type || "",
        funding_amount: c.latest_funding_amount || null,
        company_size:
          c.company_size_min && c.company_size_max
            ? `${c.company_size_min}-${c.company_size_max}`
            : "",
      };
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  return {
    id: "dormant_gold",
    title: "Dormant Gold",
    score: dormant.length >= 3 ? dormant.length * 2 : dormant.length,
    data: details.slice(0, 10),
    promptContext: `THEME: Dormant Gold — Long-Standing Connections Who Are Now High-Value

You found ${dormant.length} connections that were made 2+ years ago who are NOW in senior positions at interesting companies. These are "warm" relationships that have appreciated in value — the person you met years ago when they were a Director might now be a CTO at a funded startup.

Data (top 10 by score):
${JSON.stringify(details.slice(0, 10), null, 0)}

Write a compelling insight about this dormant gold. Emphasize the relationship angle — these aren't cold outreach, these are people who accepted your connection years ago. Highlight the most striking "glow-ups" (biggest jump in seniority or company quality). Mention how long you've been connected and their current position. The insight should make the user think "I had no idea they're now a CTO at a $50M company."`,
  };
}

function computeCompanyStageDistribution(connections: any[]): ThemeResult {
  const stages: Record<string, { count: number; examples: any[] }> = {
    "Early Stage (1-50)": { count: 0, examples: [] },
    "Growth (51-500)": { count: 0, examples: [] },
    "Scale-up (501-5,000)": { count: 0, examples: [] },
    "Enterprise (5,000+)": { count: 0, examples: [] },
  };

  const seenCompanies = new Set<string>();

  for (const c of connections) {
    const company = c.company_name || c.current_company || c.csv_company;
    if (!company || seenCompanies.has(company)) continue;
    seenCompanies.add(company);

    const size = c.company_size_max || c.company_size_min;
    if (!size) continue;

    const entry = {
      company,
      size: `${c.company_size_min || "?"}-${c.company_size_max || "?"}`,
      industry: c.company_industry || "",
      funding: c.latest_funding_type || "",
      funding_amount: c.latest_funding_amount || null,
    };

    if (size <= 50) {
      stages["Early Stage (1-50)"].count++;
      stages["Early Stage (1-50)"].examples.push(entry);
    } else if (size <= 500) {
      stages["Growth (51-500)"].count++;
      stages["Growth (51-500)"].examples.push(entry);
    } else if (size <= 5000) {
      stages["Scale-up (501-5,000)"].count++;
      stages["Scale-up (501-5,000)"].examples.push(entry);
    } else {
      stages["Enterprise (5,000+)"].count++;
      stages["Enterprise (5,000+)"].examples.push(entry);
    }
  }

  for (const stage of Object.values(stages)) {
    stage.examples = stage.examples.slice(0, 3);
  }

  const totalCompanies = seenCompanies.size;
  const dominant = Object.entries(stages).sort(
    (a, b) => b[1].count - a[1].count
  )[0];

  return {
    id: "company_stages",
    title: "Company Stage Distribution",
    score: totalCompanies >= 10 ? 8 : 3,
    data: stages,
    promptContext: `THEME: Company Stage Distribution — Where Your Network Sits on the Growth Curve

Across ${totalCompanies} unique companies in this network, here's the stage breakdown:
${Object.entries(stages)
  .map(
    ([stage, { count, examples }]) =>
      `${stage}: ${count} companies (e.g., ${examples.map((e) => e.company).join(", ")})`
  )
  .join("\n")}

The dominant stage is "${dominant[0]}" with ${dominant[1].count} companies.

Write a compelling insight about what this distribution means for the user's sales or business development strategy. If they're heavy in early-stage, they have access to fast-moving decision-makers but smaller deals. If enterprise-heavy, they're positioned for larger deals but longer cycles. Connect the distribution to practical strategy. Name specific notable companies in each tier. Keep it actionable — what should the user DO with this distribution?`,
  };
}

function computeInvestorIndustryOverlap(
  connections: any[],
  icpData: any
): ThemeResult {
  const investors = connections.filter(
    (c) =>
      c.match_type === "investor" ||
      (c.current_title || "")
        .toLowerCase()
        .match(
          /partner|investor|vc|venture|angel|fund|principal|managing director/
        ) ||
      (c.company_industry || "")
        .toLowerCase()
        .match(/venture|capital|investment|private equity/)
  );

  const icpIndustries = icpData?.industries || [];

  const details = investors.map((c) => ({
    name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
    title: c.current_title || c.csv_position || "",
    fund: c.current_company || c.csv_company || "",
    fund_industry: c.company_industry || "",
    fund_size:
      c.company_size_min && c.company_size_max
        ? `${c.company_size_min}-${c.company_size_max}`
        : "",
    location: c.location_str || c.city || "",
    score: c.match_score,
    connected_on: c.connected_on || "",
  }));

  return {
    id: "investor_overlap",
    title: "Investor × Industry Overlap",
    score: investors.length >= 2 ? investors.length * 3 : investors.length,
    data: details,
    promptContext: `THEME: Investors in Your Network

You found ${investors.length} investors/VCs/fund professionals in this network.
The user's ICP targets these industries: ${icpIndustries.join(", ") || "not specified"}.

Investor data:
${JSON.stringify(details, null, 0)}

Write a compelling insight about these investor connections. For each, mention their name, title, fund, and location. Analyze which investors might be relevant — do they invest in the user's ICP industries? Are they at firms known for a specific stage or sector? If any investors overlap with the user's target market, highlight the triangulation opportunity: "This investor backs companies in your target space — they could intro you to their portfolio companies as a vendor/partner." Also flag if any investors are at notable firms (tier-1 VCs, well-known PE firms).`,
  };
}

// ── Main endpoint ──

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let preferredThemeIndex: number | null = null;
  try {
    const body = await request.json();
    preferredThemeIndex = body.themeIndex ?? null;
  } catch {
    // no body is fine
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

    // Fetch ALL scored connections with work history
    const { data: connections } = await supabaseAdmin
      .from("network_view")
      .select(
        "first_name, last_name, current_title, csv_position, current_company, csv_company, company_name, company_industry, company_size_min, company_size_max, company_type, latest_funding_type, latest_funding_amount, total_funding_amount, latest_funding_date, hq_city, hq_country, seniority_tier, match_score, match_type, match_reasons, location_str, city, country_full_name, total_experience_years, previous_companies, connected_on, work_history"
      )
      .eq("user_id", user.id);

    if (!connections || connections.length === 0) {
      return NextResponse.json(
        { error: "No connections found" },
        { status: 404 }
      );
    }

    // Compute all 5 themes
    const themes: ThemeResult[] = [
      computeFoundersAtFundedCompanies(connections),
      computeCareerMovers(connections),
      computeDormantGold(connections),
      computeCompanyStageDistribution(connections),
      computeInvestorIndustryOverlap(connections, icpData),
    ];

    // Filter to themes with meaningful data
    const viableThemes = themes.filter(
      (t) =>
        t.score > 0 &&
        (Array.isArray(t.data)
          ? t.data.length > 0
          : Object.keys(t.data).length > 0)
    );

    if (viableThemes.length === 0) {
      return NextResponse.json(
        { error: "Not enough data for insights" },
        { status: 404 }
      );
    }

    // Sort by score (most interesting first)
    viableThemes.sort((a, b) => b.score - a.score);

    // Pick theme — rotate based on provided index or default to top-scored
    let selectedTheme: ThemeResult;
    if (
      preferredThemeIndex !== null &&
      preferredThemeIndex >= 0 &&
      preferredThemeIndex < viableThemes.length
    ) {
      selectedTheme = viableThemes[preferredThemeIndex];
    } else {
      selectedTheme = viableThemes[0];
    }

    // Send to Haiku for narrative
    const anthropic = new Anthropic();

    const response = await callAnthropicWithRetry(() =>
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `You are a sharp B2B network intelligence analyst writing for ${userData?.full_name || "a business professional"} who runs ${userData?.company_name || "their company"}.

${selectedTheme.promptContext}

Write 2-3 short paragraphs. Under 180 words total. No headers, no bullet points, no numbered lists. Bold all people names and company names using **bold** markdown.

Be specific — name real people and companies from the data. Don't be generic. Don't say "your network is diverse" or "you have strong connections." Every sentence should contain a name, a number, or a specific fact.

Write like a sharp colleague giving you a quick insight over coffee. Conversational, direct, no filler.`,
          },
        ],
      })
    );

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({
      text,
      themeId: selectedTheme.id,
      themeTitle: selectedTheme.title,
      totalViableThemes: viableThemes.length,
      viableThemeIds: viableThemes.map((t) => t.id),
    });
  } catch (err: unknown) {
    console.error("Dashboard spotlight error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate spotlight";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
