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

      // Step 5: Send to Claude Haiku for extraction
      const allContent = pageContents
        .map((p) => `--- PAGE: ${p.url} ---\n${p.content.slice(0, 8000)}`)
        .join("\n\n");

      const anthropic = new Anthropic();
      const startTime = Date.now();

      const aiResponse = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `Analyze the following website content and extract structured information about this company. Return ONLY valid JSON with no additional text.

Website: ${domain}

${allContent}

Return this exact JSON structure:
{
  "description": "company description",
  "products_services": ["list of products/services"],
  "target_market": "who they sell to",
  "customer_names": ["known customer names"],
  "industries": ["industries they serve"],
  "company_size_signals": "size indicators",
  "tech_stack": ["technologies mentioned"],
  "geography": ["regions they operate in"],
  "icp_suggestions": {
    "industries": ["suggested target industries for the user"],
    "geographies": ["suggested geographies"],
    "titles": ["suggested target titles"],
    "companySizes": ["suggested company sizes"],
    "triggers": ["suggested triggers"]
  }
}`,
          },
        ],
      });

      const durationMs = Date.now() - startTime;
      const responseText =
        aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "";

      // Parse the JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const extractedData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

      if (!extractedData) {
        throw new Error("Failed to parse extraction response");
      }

      // Log to prompt_runs
      await supabaseAdmin.from("prompt_runs").insert({
        user_id: userId,
        prompt_type: "website_extraction",
        model: "claude-haiku-4-5-20251001",
        input_tokens: aiResponse.usage?.input_tokens || 0,
        output_tokens: aiResponse.usage?.output_tokens || 0,
        duration_ms: durationMs,
        status: "completed",
      });

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
