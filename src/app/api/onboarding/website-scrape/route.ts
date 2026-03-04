import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extractDomain } from "@/lib/utils";
import Anthropic from "@anthropic-ai/sdk";

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

const PRIORITY_CATEGORIES: Record<string, RegExp[]> = {
  product: [/product/i, /solution/i, /feature/i, /platform/i, /service/i, /offering/i],
  customers: [/customer/i, /case.?stud/i, /success.?stor/i, /testimonial/i, /client/i],
  about: [/about/i, /team/i, /leadership/i, /company/i, /who.?we/i, /our.?story/i],
  pricing: [/pricing/i, /plans/i, /packages/i],
  partners: [/partner/i, /integrat/i, /ecosystem/i],
};

function categorizeLink(href: string): string | null {
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(href)) return null;
  }
  for (const [category, patterns] of Object.entries(PRIORITY_CATEGORIES)) {
    for (const pattern of patterns) {
      if (pattern.test(href)) return category;
    }
  }
  return null;
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
  const categorized: Record<string, string[]> = {
    product: [],
    customers: [],
    about: [],
    pricing: [],
    partners: [],
  };

  for (const link of links) {
    const category = categorizeLink(link);
    if (category && categorized[category]) {
      categorized[category].push(link);
    }
  }

  const prioritized: string[] = [];
  const order = ["product", "customers", "about", "pricing", "partners"];
  for (const cat of order) {
    prioritized.push(...categorized[cat]);
  }

  return prioritized.slice(0, 10);
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

    await supabaseAdmin
      .from("users")
      .update({ website_scrape_status: "scraping" })
      .eq("id", userId);

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

      // Step 3: Extract and categorize internal links
      const internalLinks = extractInternalLinks(homepageContent, domain);
      const prioritizedLinks = prioritizeLinks(internalLinks);
      console.log("SCRAPE: Found", internalLinks.length, "internal links, prioritized", prioritizedLinks.length);

      // Step 4: Scrape subpages (up to 5)
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

      // Step 5: Send to Claude Haiku for extraction (3 separate prompts)
      const allContent = pageContents
        .map((p) => `--- PAGE: ${p.url} ---\n${p.content.slice(0, 8000)}`)
        .join("\n\n");

      const anthropic = new Anthropic();
      const websiteContext = `Website: ${domain}\n\n${allContent}`;

      // Helper to call Haiku and parse JSON
      async function callHaiku(prompt: string, promptType: string) {
        const start = Date.now();
        const response = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        });
        const duration = Date.now() - start;
        const text = response.content[0].type === "text" ? response.content[0].text : "";
        const match = text.match(/\{[\s\S]*\}/);
        const parsed = match ? JSON.parse(match[0]) : null;

        // Log to prompt_runs
        await supabaseAdmin.from("prompt_runs").insert({
          user_id: userId,
          prompt_type: promptType,
          model: "claude-haiku-4-5-20251001",
          input_tokens: response.usage?.input_tokens || 0,
          output_tokens: response.usage?.output_tokens || 0,
          duration_ms: duration,
          status: parsed ? "completed" : "failed",
        });

        return parsed;
      }

      // Run all 3 prompts in parallel
      console.log("SCRAPE: Running 3 Haiku prompts...");
      const [icpResult, customerResult, triggerResult] = await Promise.all([
        // Prompt 1: ICP Extraction
        callHaiku(
          `You are analyzing a company's website to determine their Ideal Customer Profile — meaning WHO DOES THIS COMPANY SELL TO, not what industry the company itself is in.

${websiteContext}

Think carefully:
- What TYPES of companies would buy this product/service?
- What industries do their customers operate in? (not the company's own industry)
- A company can sell to MULTIPLE industries — a tech consultancy sells to healthcare, finance, manufacturing, etc.
- Look at case studies, customer logos, testimonials, and product descriptions for clues
- If they mention specific verticals they serve, include ALL of them
- Consider adjacent industries — if they sell to "tech companies" they likely also sell to fintech, healthtech, edtech, etc.

Return ONLY valid JSON with no additional text. Use ONLY values from the valid options listed below:

{
  "target_industries": ["..."],
  "target_geographies": ["..."],
  "target_titles": ["..."],
  "company_sizes": ["..."],
  "revenue_ranges": ["..."],
  "funding_stages": ["..."]
}

VALID OPTIONS:
Industries: SaaS, AI / ML, Cybersecurity, Developer Tools, Data & Analytics, Enterprise Software, Cloud & Infrastructure, Internet & Web Services, Hardware & Semiconductors, Telecommunications & Networking, Robotics & Automation, Blockchain & Web3, Fintech, Banking & Lending, Insurance / Insurtech, Payments & Processing, Investment & Wealth Management, Capital Markets, HealthTech / Digital Health, Biotech & Pharma, Medical Devices, Healthcare Services, Clinical Research, E-commerce, D2C Brands, Marketplace, Food & Beverage, Consumer Electronics, Manufacturing, Logistics & Supply Chain, Energy & Oil, Cleantech / Climate, Construction & Real Estate, IT Services Consulting, IT Outsourcing / Managed Services, Systems Integration, Staffing & Recruitment, Legal Tech, HR Tech, Media & Publishing, EdTech / E-Learning, Gaming, Advertising & MarTech, Real Estate / PropTech, Commercial Real Estate, Construction Tech
Company sizes: 1–10 employees, 11–50 employees, 51–200 employees, 201–500 employees, 501–1,000 employees, 1,001–5,000 employees, 5,001–10,000 employees, 10,000+ employees
Revenue: Pre-revenue, $0–$1M ARR, $1M–$5M ARR, $5M–$20M ARR, $20M–$100M ARR, $100M+ ARR
Funding: Pre-seed, Seed, Series A, Series B, Series C+, PE-backed, Public, Bootstrapped
Geography: North America, Europe, UK, APAC, MENA, LATAM, India, Global
Titles: CEO, CTO, CFO, COO, CISO, CIO, VP Engineering, VP Product, VP Sales, VP Marketing, Head of IT, Head of Data, Head of Engineering, Director of Engineering, Director of Product, General Manager, Managing Director

Include at minimum 3 industries. Be generous — include all plausible industries.`,
          "website_icp_extraction"
        ),

        // Prompt 2: Customer List Extraction
        callHaiku(
          `Extract any customer, client, or partner names mentioned on this website. Look for: logo sections, case studies, testimonials, partner pages, "trusted by" sections. Return ONLY valid JSON with no additional text.

${websiteContext}

Return this exact JSON structure:
{
  "customers": ["list of customer/client company names found"],
  "source": "logos | case_studies | testimonials | partner_page | mixed"
}`,
          "website_customer_extraction"
        ),

        // Prompt 3: Sales Trigger Identification
        callHaiku(
          `You are analyzing a company's website to identify HIGH-INTENT BUYING SIGNALS — organizational events or changes at a potential customer company that would make them likely to buy from this company RIGHT NOW.

${websiteContext}

Think about ORGANIZATIONAL TRIGGERS — things that happen at a company that create urgency to buy:

Categories to consider:
1. FUNDING & GROWTH: "Recently raised Series B+", "IPO preparation", "Rapid headcount growth (50%+ YoY)"
2. LEADERSHIP CHANGES: "New CTO/CIO/CISO hired in last 6 months", "New VP Engineering appointed"
3. STRATEGIC INITIATIVES: "Announced digital transformation initiative", "Opening new geographic office", "Launching new product line"
4. TECHNOLOGY SIGNALS: "Migrating from legacy systems", "Evaluating new vendors (RFP published)", "Tech stack modernization"
5. HIRING PATTERNS: "Hiring 10+ engineers in India", "Posting for relevant roles", "Building out security team"
6. MARKET EVENTS: "Industry regulation change requiring compliance", "Competitor acquisition creating uncertainty"
7. EXPANSION: "Expanding to India/APAC", "Setting up GCC/offshore center", "M&A activity"

Return EXACTLY 5 triggers. Make them SPECIFIC to what this company sells — not generic. Each trigger should be a clear sentence that a sales rep could use to identify a hot prospect.

Return ONLY valid JSON with no additional text:
{
  "triggers": [
    "Recently raised Series B or later funding and scaling engineering team",
    "Hired a new CTO or VP Engineering in the last 6 months",
    "Posted 10+ open engineering roles in India on LinkedIn",
    "Announced plans to set up or expand a Global Capability Center",
    "Published RFP or vendor evaluation for relevant category"
  ]
}`,
          "website_trigger_extraction"
        ),
      ]);

      console.log("SCRAPE: All prompts complete. ICP:", !!icpResult, "Customers:", !!customerResult, "Triggers:", !!triggerResult);

      if (!icpResult) {
        throw new Error("Failed to parse ICP extraction response");
      }

      // Combine all results into final scrape data
      const extractedData = {
        icp_suggestions: {
          target_industries: icpResult.target_industries || [],
          target_geographies: icpResult.target_geographies || [],
          target_titles: icpResult.target_titles || [],
          company_sizes: icpResult.company_sizes || [],
          revenue_ranges: icpResult.revenue_ranges || [],
          funding_stages: icpResult.funding_stages || [],
        },
        customer_list: customerResult || { customers: [], source: "mixed" },
        sales_triggers: triggerResult || { triggers: [] },
      };

      // Update user with extracted data
      const { error: saveError } = await supabaseAdmin
        .from("users")
        .update({
          website_scrape_data: extractedData,
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
      await supabaseAdmin
        .from("users")
        .update({
          website_scrape_status: "failed",
          website_scrape_error: error instanceof Error ? error.message : String(error),
        })
        .eq("id", userId);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
