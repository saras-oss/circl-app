import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extractDomain } from "@/lib/utils";
import Anthropic from "@anthropic-ai/sdk";

const SERPER_API_KEY = process.env.SERPER_API_KEY!;
const ENRICHLAYER_API_KEY = process.env.ENRICHLAYER_API_KEY!;
const CACHE_FRESHNESS_DAYS = 60;
const DEFAULT_BATCH_SIZE = 4;

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

function isFresh(enrichedAt: string | null): boolean {
  if (!enrichedAt) return false;
  const enrichedDate = new Date(enrichedAt);
  const now = new Date();
  const diffDays =
    (now.getTime() - enrichedDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays < CACHE_FRESHNESS_DAYS;
}

async function enrichProfile(
  linkedinUrl: string
): Promise<Record<string, unknown> | null> {
  const response = await fetch(
    "https://api.enrichlayer.com/v1/linkedin/profile",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENRICHLAYER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: linkedinUrl }),
    }
  );

  if (!response.ok) return null;
  return response.json();
}

async function enrichCompanyViaScrape(
  domain: string,
  userId: string
): Promise<Record<string, unknown> | null> {
  // Check existing enriched company
  const { data: existing } = await supabaseAdmin
    .from("enriched_companies")
    .select("*")
    .eq("domain", domain)
    .single();

  if (existing && isFresh(existing.enriched_at)) {
    return existing.data;
  }

  // Scrape the company domain
  const homepageUrl =
    (await serperSearch(domain)) || `https://${domain}`;
  const homepageContent = await serperScrape(homepageUrl);

  if (!homepageContent) return null;

  const anthropic = new Anthropic();

  const aiResponse = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Analyze this company website content and extract structured information. Return ONLY valid JSON.

Domain: ${domain}
Content: ${homepageContent.slice(0, 12000)}

Return this JSON structure:
{
  "description": "company description",
  "products_services": ["list of products/services"],
  "target_market": "who they sell to",
  "industries": ["industries they serve"],
  "company_size_signals": "size indicators",
  "tech_stack": ["technologies mentioned"],
  "geography": ["regions they operate in"],
  "employee_count_estimate": "estimated number of employees",
  "funding_stage": "if detectable"
}`,
      },
    ],
  });

  const responseText =
    aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "";
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);

  let companyData: Record<string, unknown> | null = null;
  try {
    companyData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch {
    companyData = null;
  }

  if (companyData) {
    await supabaseAdmin.from("enriched_companies").upsert(
      {
        domain,
        data: companyData,
        enriched_at: new Date().toISOString(),
      },
      { onConflict: "domain" }
    );

    // Log company extraction prompt
    await supabaseAdmin.from("prompt_runs").insert({
      user_id: userId,
      prompt_type: "company_extraction",
      model: "claude-haiku-4-5-20251001",
      input_tokens: aiResponse.usage?.input_tokens || 0,
      output_tokens: aiResponse.usage?.output_tokens || 0,
      duration_ms: 0,
      status: "completed",
    });
  }

  return companyData;
}

async function selectFreeTierConnections(userId: string): Promise<void> {
  // Check if selections already made
  const { count: existingSelections } = await supabaseAdmin
    .from("user_connections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_free_tier_selection", true);

  if (existingSelections && existingSelections > 0) return;

  // Get tier1 connections sorted by connected_on ASC
  const { data: tier1 } = await supabaseAdmin
    .from("user_connections")
    .select("id")
    .eq("user_id", userId)
    .eq("enrichment_tier", "tier1")
    .order("connected_on", { ascending: true })
    .limit(100);

  const selectedIds: string[] = (tier1 || []).map((c) => c.id);

  // If fewer than 100, backfill with tier2
  if (selectedIds.length < 100) {
    const remaining = 100 - selectedIds.length;
    const { data: tier2 } = await supabaseAdmin
      .from("user_connections")
      .select("id")
      .eq("user_id", userId)
      .eq("enrichment_tier", "tier2")
      .order("connected_on", { ascending: true })
      .limit(remaining);

    if (tier2) {
      selectedIds.push(...tier2.map((c) => c.id));
    }
  }

  // Mark selected connections
  if (selectedIds.length > 0) {
    await supabaseAdmin
      .from("user_connections")
      .update({ is_free_tier_selection: true })
      .in("id", selectedIds);
  }
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

    const { userId, batchSize } = await request.json();

    if (userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const effectiveBatchSize = batchSize || DEFAULT_BATCH_SIZE;

    // Get user's subscription tier
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("subscription_tier")
      .eq("id", userId)
      .single();

    const subscriptionTier = userData?.subscription_tier || "free";

    // For free tier, select top 100 if not already done
    if (subscriptionTier === "free") {
      await selectFreeTierConnections(userId);
    }

    // Build query for next batch of connections to enrich
    let query = supabaseAdmin
      .from("user_connections")
      .select("id, first_name, last_name, company, position, linkedin_url, enrichment_tier")
      .eq("user_id", userId)
      .eq("enrichment_status", "pending")
      .order("id", { ascending: true })
      .limit(effectiveBatchSize);

    if (subscriptionTier === "free") {
      query = query.eq("is_free_tier_selection", true);
    } else {
      // Paid tiers: enrich tier1 + tier2
      query = query.in("enrichment_tier", ["tier1", "tier2"]);
    }

    const { data: connections, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!connections || connections.length === 0) {
      // Check if all enrichments are done
      await supabaseAdmin
        .from("users")
        .update({ processing_status: "completed" })
        .eq("id", userId);

      return NextResponse.json({
        processed: 0,
        remaining: 0,
        hasMore: false,
        cached: 0,
        freshEnriched: 0,
      });
    }

    let cacheHits = 0;
    let freshCount = 0;

    // Process batch in parallel (max 4)
    const enrichmentResults = await Promise.allSettled(
      connections.map(async (conn) => {
        const linkedinUrl = conn.linkedin_url;

        if (!linkedinUrl) {
          await supabaseAdmin
            .from("user_connections")
            .update({ enrichment_status: "skipped" })
            .eq("id", conn.id);
          return { type: "skipped" as const };
        }

        // Check enriched_profiles cache
        const { data: existingProfile } = await supabaseAdmin
          .from("enriched_profiles")
          .select("*")
          .eq("linkedin_url", linkedinUrl)
          .single();

        let profileData: Record<string, unknown> | null = null;

        if (existingProfile && isFresh(existingProfile.enriched_at)) {
          // Cache hit
          profileData = existingProfile.data;
          await supabaseAdmin
            .from("user_connections")
            .update({ enrichment_status: "cached" })
            .eq("id", conn.id);
          return { type: "cached" as const, profileData };
        }

        // Cache miss or stale: call EnrichLayer API
        const enrichedData = await enrichProfile(linkedinUrl);

        if (enrichedData) {
          // Upsert to enriched_profiles
          await supabaseAdmin.from("enriched_profiles").upsert(
            {
              linkedin_url: linkedinUrl,
              data: enrichedData,
              enriched_at: new Date().toISOString(),
            },
            { onConflict: "linkedin_url" }
          );

          profileData = enrichedData;

          // Company enrichment (dedup)
          const companyUrl =
            (enrichedData.company_url as string) ||
            (enrichedData.company_website as string) ||
            "";
          if (companyUrl) {
            const companyDomain = extractDomain(companyUrl);
            if (companyDomain) {
              await enrichCompanyViaScrape(companyDomain, userId);
            }
          }

          await supabaseAdmin
            .from("user_connections")
            .update({ enrichment_status: "enriched" })
            .eq("id", conn.id);

          return { type: "enriched" as const, profileData };
        }

        // EnrichLayer API failed
        await supabaseAdmin
          .from("user_connections")
          .update({ enrichment_status: "failed" })
          .eq("id", conn.id);

        return { type: "failed" as const };
      })
    );

    for (const result of enrichmentResults) {
      if (result.status === "fulfilled") {
        if (result.value.type === "cached") cacheHits++;
        if (result.value.type === "enriched") freshCount++;
      }
    }

    // Count remaining connections to enrich
    let remainingQuery = supabaseAdmin
      .from("user_connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("enrichment_status", "pending");

    if (subscriptionTier === "free") {
      remainingQuery = remainingQuery.eq("is_free_tier_selection", true);
    } else {
      remainingQuery = remainingQuery.in("enrichment_tier", ["tier1", "tier2"]);
    }

    const { count: remaining } = await remainingQuery;

    // Update processing progress
    const { count: totalEligible } = await supabaseAdmin
      .from("user_connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("enrichment_status", ["enriched", "cached", "pending", "failed"])
      .in("enrichment_tier", subscriptionTier === "free" ? ["tier1", "tier2", "tier3", "tier4"] : ["tier1", "tier2"]);

    const enrichedSoFar =
      (totalEligible || 0) - (remaining || 0);
    const progress =
      totalEligible && totalEligible > 0
        ? Math.round((enrichedSoFar / totalEligible) * 100)
        : 100;

    await supabaseAdmin
      .from("users")
      .update({ processing_progress: progress })
      .eq("id", userId);

    return NextResponse.json({
      processed: connections.length,
      remaining: remaining || 0,
      hasMore: (remaining || 0) > 0,
      cached: cacheHits,
      freshEnriched: freshCount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
