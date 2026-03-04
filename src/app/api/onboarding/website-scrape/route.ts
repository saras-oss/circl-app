import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extractDomain } from "@/lib/utils";
import Anthropic from "@anthropic-ai/sdk";

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
  const response = await fetch("https://scraper.serper.dev", {
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

    // Fire-and-forget: return immediately, but run the pipeline
    // We use waitUntil-style approach by not awaiting the main pipeline
    // but since Next.js API routes need to complete, we run it inline
    // and return 200 regardless of outcome
    try {
      const domain = extractDomain(websiteUrl);

      // Step 1: Search for homepage URL
      const homepageUrl =
        (await serperSearch(domain)) || `https://${domain}`;

      // Step 2: Scrape homepage
      const homepageContent = await serperScrape(homepageUrl);

      if (!homepageContent) {
        throw new Error("Failed to scrape homepage");
      }

      // Step 3: Extract and categorize internal links
      const internalLinks = extractInternalLinks(homepageContent, domain);
      const prioritizedLinks = prioritizeLinks(internalLinks);

      // Step 4: Scrape subpages (up to 10)
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
      const [icpResult, customerResult, triggerResult] = await Promise.all([
        // Prompt 1: ICP Extraction
        callHaiku(
          `Based on this company's website content, determine their ideal customer profile. Infer from their product descriptions, pricing pages, and messaging who they sell to. Return ONLY valid JSON with no additional text.

${websiteContext}

Return this exact JSON structure:
{
  "description": "company description",
  "products_services": ["list of products/services"],
  "target_market": "who they sell to",
  "target_industries": ["specific industries they serve or should target"],
  "target_geographies": ["regions they operate in or should target"],
  "target_titles": ["job titles of their ideal buyers"],
  "company_sizes": ["target company size ranges"],
  "revenue_ranges": ["target revenue ranges"],
  "funding_stages": ["target funding stages"]
}`,
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
          `Based on this company's market and offerings, identify high-intent buying signals that would indicate a potential customer is ready to buy from them. Return ONLY valid JSON with no additional text.

${websiteContext}

Return this exact JSON structure:
{
  "triggers": ["list of specific, actionable buying triggers"]
}

Examples of good triggers: "Recently raised Series B+", "Expanding engineering team", "Migrating from legacy systems", "Opening new geographic markets", "Hiring for relevant roles", "Published RFP for relevant category"`,
          "website_trigger_extraction"
        ),
      ]);

      if (!icpResult) {
        throw new Error("Failed to parse ICP extraction response");
      }

      // Combine all results into final scrape data
      const extractedData = {
        description: icpResult.description || "",
        products_services: icpResult.products_services || [],
        target_market: icpResult.target_market || "",
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
      await supabaseAdmin
        .from("users")
        .update({
          website_scrape_data: extractedData,
          website_scrape_status: "completed",
        })
        .eq("id", userId);
    } catch {
      // Fire-and-forget: mark as failed but don't error the response
      await supabaseAdmin
        .from("users")
        .update({ website_scrape_status: "failed" })
        .eq("id", userId);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
