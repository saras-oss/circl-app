import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extractDomain } from "@/lib/utils";
import Anthropic from "@anthropic-ai/sdk";
import { callAnthropicWithRetry } from "@/lib/anthropic-retry";
import { deriveFunctionsFromTitles } from "@/lib/taxonomy/functions";

export const maxDuration = 60; // seconds — requires Vercel Pro plan

const SERPER_API_KEY = process.env.SERPER_API_KEY!;

const SKIP_PATTERNS = [
  /blog/i,
  /careers/i,
  /jobs/i,
  /legal/i,
  /privacy/i,
  /terms/i,
  /cookie/i,
  /news/i,
  /press/i,
  /media-kit/i,
  /sitemap/i,
  /login/i,
  /signup/i,
  /sign-up/i,
  /sign-in/i,
];

const PRIORITY_PATTERNS: RegExp[] = [
  /customer/i, /case.?stud/i, /success.?stor/i, /testimonial/i, /client/i,
  /our-customers/i, /our-clients/i, /client-stories/i, /who-we-serve/i,
  /portfolio/i, /our-work/i, /reviews/i, /industries-served/i,
  /partner/i, /integrat/i, /ecosystem/i,
  /about/i, /team/i, /company/i, /who.?we/i,
  /product/i, /solution/i, /feature/i, /platform/i, /service/i,
];

function shouldSkip(href: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(href));
}

function getPriority(href: string): number {
  if (shouldSkip(href)) return -1;
  for (let i = 0; i < PRIORITY_PATTERNS.length; i++) {
    if (PRIORITY_PATTERNS[i].test(href)) return i;
  }
  return 999;
}

function extractInternalLinks(html: string, baseDomain: string): string[] {
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  const links = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    try {
      let absoluteUrl: string;
      if (href.startsWith("http")) {
        absoluteUrl = href;
      } else if (href.startsWith("/")) {
        absoluteUrl = `https://${baseDomain}${href}`;
      } else {
        continue;
      }

      const parsed = new URL(absoluteUrl);
      const linkDomain = parsed.hostname.replace(/^www\./, "");
      if (linkDomain === baseDomain && parsed.pathname !== "/") {
        links.add(absoluteUrl.split("#")[0].split("?")[0].replace(/\/+$/, ""));
      }
    } catch {
      continue;
    }
  }

  return Array.from(links);
}

function prioritizeLinks(links: string[]): string[] {
  return links
    .filter((l) => !shouldSkip(l))
    .sort((a, b) => getPriority(a) - getPriority(b))
    .slice(0, 3); // Max 3 subpages to fit in 60s budget
}

async function serperSearch(query: string): Promise<string | null> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (data.organic && data.organic.length > 0) {
    return data.organic[0].link;
  }
  return null;
}

async function serperScrape(url: string): Promise<string | null> {
  const response = await fetch("https://scrape.serper.dev", {
    method: "POST",
    headers: {
      "X-API-KEY": SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data.text || data.html || data.content || null;
}

const EXTRACTION_PROMPT = `You are analyzing a company's website. Extract THREE things in a single JSON response.

TASK 1 — IDEAL CUSTOMER PROFILE (who does this company SELL TO?):
- What TYPES of companies would buy this product/service?
- What industries do their CUSTOMERS operate in? (not the company's own industry)
- Look at case studies, customer logos, testimonials, product descriptions
- Include ALL plausible industries (minimum 3)

TASK 2 — CUSTOMER NAMES:
- Extract REAL company/brand names of customers, clients, or partners
- Look for: logo sections, "trusted by" banners, case studies, testimonials, partner pages
- ONLY real names (e.g. "Stripe", "Deloitte") — NEVER placeholders like "a fintech company"
- If you can't find real names, return an empty array

TASK 3 — SALES TRIGGERS:
- Identify 5 organizational events at a potential customer that would create urgency to buy from this company
- Think: funding rounds, leadership changes, hiring patterns, tech migrations, expansion plans
- Make them SPECIFIC to what this company sells

For target_functions: Think about what TYPES of people would buy this company's product.
If they sell developer tools → engineering_technology.
If they sell HR software → hr_people.
If they sell financial analytics → finance.
Select 2-4 functions most likely to be buyers.

For target_titles: List specific titles within the selected functions that are most relevant.

Return ONLY valid JSON with no additional text. Use ONLY values from the valid options for ICP fields:

{
  "icp_suggestions": {
    "target_industries": ["..."],
    "target_geographies": ["..."],
    "target_functions": ["..."],
    "target_titles": ["..."],
    "company_sizes": ["..."],
    "revenue_ranges": ["..."],
    "funding_stages": ["..."]
  },
  "customer_list": {
    "customers": ["..."],
    "source": "logos | case_studies | testimonials | partner_page | mixed"
  },
  "sales_triggers": {
    "triggers": ["trigger 1", "trigger 2", "trigger 3", "trigger 4", "trigger 5"]
  }
}

VALID OPTIONS:
Industries: SaaS, AI / ML, Cybersecurity, Developer Tools, Data & Analytics, Enterprise Software, Cloud & Infrastructure, Internet & Web Services, Hardware & Semiconductors, Telecommunications & Networking, Robotics & Automation, Blockchain & Web3, Fintech, Banking & Lending, Insurance / Insurtech, Payments & Processing, Investment & Wealth Management, Capital Markets, HealthTech / Digital Health, Biotech & Pharma, Medical Devices, Healthcare Services, Clinical Research, E-commerce, D2C Brands, Marketplace, Food & Beverage, Consumer Electronics, Manufacturing, Logistics & Supply Chain, Energy & Oil, Cleantech / Climate, Construction & Real Estate, IT Services Consulting, IT Outsourcing / Managed Services, Systems Integration, Staffing & Recruitment, Legal Tech, HR Tech, Media & Publishing, EdTech / E-Learning, Gaming, Advertising & MarTech, Real Estate / PropTech, Commercial Real Estate, Construction Tech
Company sizes: 1–10 employees, 11–50 employees, 51–200 employees, 201–500 employees, 501–1,000 employees, 1,001–5,000 employees, 5,001–10,000 employees, 10,000+ employees
Revenue: Pre-revenue, $0–$1M ARR, $1M–$5M ARR, $5M–$20M ARR, $20M–$100M ARR, $100M+ ARR
Funding: Pre-seed, Seed, Series A, Series B, Series C+, PE-backed, Public, Bootstrapped
Geography: North America, Europe, UK, APAC, MENA, LATAM, India, Global
Functions (select which functional areas the company's ideal buyers work in):
  engineering_technology, product, operations, sales_business_development,
  marketing, finance, hr_people, it_security, legal_compliance, general_management
Titles (optional — specific titles within those functions):
  CEO, CTO, CFO, COO, CISO, CIO, VP Engineering, VP Product, VP Sales,
  VP Marketing, Head of IT, Head of Data, Head of Engineering,
  Director of Engineering, Director of Product, General Manager,
  Managing Director, CHRO, VP People, Head of Talent, VP Operations,
  Head of Growth, VP Finance, Head of BD`;

const STUCK_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, websiteUrl } = await request.json();

    if (userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fix C: Reset stuck "scraping" status
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("website_scrape_status, updated_at")
      .eq("id", userId)
      .single();

    if (existingUser?.website_scrape_status === "scraping") {
      const updatedAt = new Date(existingUser.updated_at).getTime();
      if (Date.now() - updatedAt > STUCK_THRESHOLD_MS) {
        await supabaseAdmin
          .from("users")
          .update({
            website_scrape_status: "pending",
            website_scrape_error: null,
          })
          .eq("id", userId);
      }
    }

    await supabaseAdmin
      .from("users")
      .update({ website_scrape_status: "scraping", website_scrape_error: null })
      .eq("id", userId);

    let scrapeError: string | null = null;

    try {
      const domain = extractDomain(websiteUrl);
      console.log("SCRAPE: Starting for", websiteUrl, "domain:", domain);

      // Step 1: Search for homepage URL
      const homepageUrl =
        (await serperSearch(domain)) || `https://${domain}`;

      // Step 2: Scrape homepage
      const homepageContent = await serperScrape(homepageUrl);
      console.log("SCRAPE: Homepage scraped, got content:", !!homepageContent);

      if (!homepageContent) {
        throw new Error("Failed to scrape homepage");
      }

      // Step 3: Extract and prioritize internal links (max 3)
      const internalLinks = extractInternalLinks(homepageContent, domain);
      const prioritizedLinks = prioritizeLinks(internalLinks);
      console.log("SCRAPE: Found", internalLinks.length, "links, scraping top", prioritizedLinks.length);

      // Step 4: Scrape subpages (max 3)
      const pageContents: { url: string; content: string }[] = [
        { url: homepageUrl, content: homepageContent },
      ];

      const subpageScrapes = await Promise.allSettled(
        prioritizedLinks.map(async (link) => {
          const content = await serperScrape(link);
          return content ? { url: link, content } : null;
        })
      );

      for (const result of subpageScrapes) {
        if (result.status === "fulfilled" && result.value) {
          pageContents.push(result.value);
        }
      }
      console.log("SCRAPE: Scraped", pageContents.length - 1, "subpages");

      // Step 5: Single combined LLM call for all extraction
      const allContent = pageContents
        .map((p) => `--- PAGE: ${p.url} ---\n${p.content.slice(0, 8000)}`)
        .join("\n\n");

      const anthropic = new Anthropic();
      const userMessage = `Website: ${domain}\n\n${allContent}`;

      console.log("SCRAPE: Running single extraction prompt...");
      const start = Date.now();

      let extractedData: {
        icp_suggestions: Record<string, unknown>;
        customer_list: Record<string, unknown>;
        sales_triggers: Record<string, unknown>;
      } | null = null;

      // Try with full content first
      try {
        extractedData = await runExtraction(anthropic, userMessage, userId);
      } catch (fullError) {
        console.warn("SCRAPE: Full extraction failed, retrying with homepage only:", fullError);
        // Fallback: retry with just homepage content
        const fallbackMessage = `Website: ${domain}\n\n--- PAGE: ${homepageUrl} ---\n${homepageContent.slice(0, 12000)}`;
        extractedData = await runExtraction(anthropic, fallbackMessage, userId);
      }

      if (!extractedData?.icp_suggestions) {
        throw new Error("Failed to extract ICP data from website");
      }

      // Normalize the extracted data
      const extractedTitles = (extractedData.icp_suggestions.target_titles as string[]) || [];
      const normalizedData = {
        icp_suggestions: {
          target_industries: (extractedData.icp_suggestions.target_industries as string[]) || [],
          target_geographies: (extractedData.icp_suggestions.target_geographies as string[]) || [],
          target_functions: (extractedData.icp_suggestions.target_functions as string[]) || deriveFunctionsFromTitles(extractedTitles),
          target_titles: extractedTitles,
          company_sizes: (extractedData.icp_suggestions.company_sizes as string[]) || [],
          revenue_ranges: (extractedData.icp_suggestions.revenue_ranges as string[]) || [],
          funding_stages: (extractedData.icp_suggestions.funding_stages as string[]) || [],
        },
        customer_list: extractedData.customer_list || { customers: [], source: "mixed" },
        sales_triggers: extractedData.sales_triggers || { triggers: [] },
      };

      const duration = Date.now() - start;
      console.log("SCRAPE: Extraction complete in", duration, "ms");

      // Save to DB
      const { error: saveError } = await supabaseAdmin
        .from("users")
        .update({
          website_scrape_data: normalizedData,
          website_scrape_status: "completed",
        })
        .eq("id", userId);

      if (saveError) {
        console.error("SCRAPE: Failed to save to DB:", saveError.message);
        throw new Error(`DB save failed: ${saveError.message}`);
      }
      console.log("SCRAPE: Saved successfully for user", userId);
    } catch (error) {
      console.error("SCRAPE PIPELINE ERROR:", error);
      scrapeError = error instanceof Error ? error.message : String(error);
      await supabaseAdmin
        .from("users")
        .update({
          website_scrape_status: "failed",
          website_scrape_error: scrapeError,
        })
        .eq("id", userId);
    }

    // Fix D: Return actual error status to frontend
    if (scrapeError) {
      return NextResponse.json({ success: false, error: scrapeError });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function runExtraction(
  anthropic: Anthropic,
  content: string,
  userId: string
) {
  const response = await callAnthropicWithRetry(
    () =>
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: EXTRACTION_PROMPT,
        messages: [{ role: "user", content }],
      }),
    3 // Max 3 retries for scrape endpoint
  );

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  const parsed = match ? JSON.parse(match[0]) : null;

  // Log to prompt_runs
  await supabaseAdmin.from("prompt_runs").insert({
    user_id: userId,
    prompt_type: "website_extraction",
    model: "claude-haiku-4-5-20251001",
    system_prompt: EXTRACTION_PROMPT.slice(0, 5000),
    user_prompt: content.slice(0, 10000),
    response: text,
    structured_output: parsed,
    input_tokens: response.usage?.input_tokens || 0,
    output_tokens: response.usage?.output_tokens || 0,
    duration_ms: 0,
  });

  return parsed;
}
