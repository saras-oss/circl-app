import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ENRICHLAYER_API_KEY = process.env.ENRICHLAYER_API_KEY!;
const CACHE_FRESHNESS_DAYS = 60;
const DEFAULT_BATCH_SIZE = 4;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize LinkedIn URL for consistent cache lookups */
function normalizeLinkedInUrl(url: string): string {
  if (!url) return "";
  let normalized = url.trim().toLowerCase();
  // Remove query parameters
  const queryIndex = normalized.indexOf("?");
  if (queryIndex !== -1) normalized = normalized.slice(0, queryIndex);
  // Remove hash
  const hashIndex = normalized.indexOf("#");
  if (hashIndex !== -1) normalized = normalized.slice(0, hashIndex);
  // Remove trailing slash
  if (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
  // Ensure consistent protocol
  if (normalized.startsWith("http://")) {
    normalized = "https://" + normalized.slice(7);
  }
  return normalized;
}

function isFresh(enrichedAt: string | null): boolean {
  if (!enrichedAt) return false;
  const diffDays =
    (Date.now() - new Date(enrichedAt).getTime()) / (1000 * 60 * 60 * 24);
  return diffDays < CACHE_FRESHNESS_DAYS;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);
    if (response.status === 429) {
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(
        `EnrichLayer 429 — waiting ${waitTime}ms (retry ${attempt + 1}/${maxRetries})`
      );
      await new Promise((r) => setTimeout(r, waitTime));
      continue;
    }
    return response;
  }
  throw new Error(`EnrichLayer rate-limited after ${maxRetries} retries`);
}

// ---------------------------------------------------------------------------
// Person profile helpers
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

function getCurrentRole(experiences: any[] | undefined) {
  if (!experiences?.length) return null;
  return experiences.find((e: any) => !e.ends_at) || experiences[0];
}

function parseStartDate(startsAt: any): string | null {
  if (!startsAt?.year) return null;
  const month = String(startsAt.month || 1).padStart(2, "0");
  const day = String(startsAt.day || 1).padStart(2, "0");
  return `${startsAt.year}-${month}-${day}`;
}

function calculateTotalYears(experiences: any[] | undefined): number | null {
  if (!experiences?.length) return null;
  const earliest = experiences[experiences.length - 1]?.starts_at;
  if (!earliest?.year) return null;
  return new Date().getFullYear() - earliest.year;
}

function countUniqueCompanies(experiences: any[] | undefined): number {
  if (!experiences?.length) return 0;
  return new Set(experiences.map((e: any) => e.company).filter(Boolean)).size;
}

function extractPreviousCompanies(experiences: any[] | undefined): string[] {
  if (!experiences?.length) return [];
  const current = experiences[0]?.company;
  return [
    ...new Set(
      experiences
        .map((e: any) => e.company)
        .filter(Boolean)
        .filter((c: string) => c !== current)
    ),
  ];
}

function extractPreviousTitles(experiences: any[] | undefined): string[] {
  if (!experiences?.length) return [];
  return experiences
    .slice(1)
    .map((e: any) => e.title)
    .filter(Boolean);
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// EnrichLayer API — Person Profile
// ---------------------------------------------------------------------------

async function enrichProfile(
  linkedinUrl: string,
  connectionId: string
): Promise<Record<string, unknown> | null> {
  const url = `https://enrichlayer.com/api/v2/profile?profile_url=${encodeURIComponent(linkedinUrl)}`;

  const response = await fetchWithRetry(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${ENRICHLAYER_API_KEY}` },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error("ENRICHLAYER PERSON ERROR:", {
      linkedinUrl,
      status: response.status,
      statusText: response.statusText,
      body: errorBody.slice(0, 500),
    });

    await supabaseAdmin
      .from("user_connections")
      .update({
        enrichment_status: "failed",
        enrichment_error: `EnrichLayer ${response.status}: ${errorBody.slice(0, 500)}`,
      })
      .eq("id", connectionId);

    return null;
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Map person response → enriched_profiles row
// ---------------------------------------------------------------------------

function mapPersonToProfile(
  linkedinUrl: string,
  r: Record<string, unknown>
): Record<string, unknown> {
  const experiences = r.experiences as any[] | undefined;
  const education = r.education as any[] | undefined;
  const currentRole = getCurrentRole(experiences);
  const fundingData = r.funding_data as any[] | undefined;

  return {
    linkedin_url: linkedinUrl,
    public_identifier: r.public_identifier,
    full_name: r.full_name,
    first_name: r.first_name,
    last_name: r.last_name,
    headline: r.headline,
    summary: r.summary,
    occupation: r.occupation,
    profile_pic_url: r.profile_pic_url,
    background_cover_image_url: r.background_cover_image_url,
    gender: r.gender,

    location_str: r.location_str,
    country: r.country,
    country_full_name: r.country_full_name,
    city: r.city,
    state: r.state,

    current_company: currentRole?.company,
    current_title: currentRole?.title,
    current_company_linkedin: currentRole?.company_linkedin_profile_url,
    current_company_start_date: parseStartDate(currentRole?.starts_at),

    work_history: experiences,
    education,

    total_experience_years: calculateTotalYears(experiences),
    companies_worked_at: countUniqueCompanies(experiences),
    previous_companies: extractPreviousCompanies(experiences),
    previous_titles: extractPreviousTitles(experiences),

    education_schools: education?.map((e: any) => e.school).filter(Boolean),
    education_degrees: education
      ?.map((e: any) => e.degree_name)
      .filter(Boolean),
    education_fields: education
      ?.map((e: any) => e.field_of_study)
      .filter(Boolean),

    follower_count: r.follower_count,
    connections_count: r.connections,
    people_also_viewed: (r.people_also_viewed as any[])?.slice(0, 10),
    similar_profiles: r.similarly_named_profiles,

    skills: r.skills,
    languages: r.languages,
    languages_and_proficiencies: r.languages_and_proficiencies,
    certifications: r.certifications,
    certifications_list: (r.certifications as any[])
      ?.map((c: any) => c.name)
      .filter(Boolean),

    awards: r.accomplishment_honors_awards,
    awards_count: (r.accomplishment_honors_awards as any[])?.length || 0,
    publications: r.accomplishment_publications,
    publications_count: (r.accomplishment_publications as any[])?.length || 0,
    patents: r.accomplishment_patents,
    patent_count: (r.accomplishment_patents as any[])?.length || 0,
    courses: r.accomplishment_courses,
    projects: r.accomplishment_projects,
    organizations: r.accomplishment_organisations,
    test_scores: r.accomplishment_test_scores,

    activities: r.activities,
    articles: r.articles,
    recent_activity_count: (r.activities as any[])?.length || 0,
    is_linkedin_active: ((r.activities as any[])?.length || 0) > 3,
    groups: r.groups,
    volunteer_work: r.volunteer_work,
    recommendations: r.recommendations,
    interests: r.interests,

    personal_emails: r.personal_emails,
    personal_numbers: r.personal_numbers,

    inferred_salary: r.inferred_salary,
    industry: r.industry,

    raw_data: r,
    enriched_at: new Date().toISOString(),
    enrichment_source: "enrichlayer",
    enrichlayer_last_updated: (r.meta as any)?.last_updated,
  };
}

// ---------------------------------------------------------------------------
// EnrichLayer API — Company Profile
// ---------------------------------------------------------------------------

async function enrichCompany(
  companyLinkedInUrl: string
): Promise<Record<string, unknown> | null> {
  const normalizedCompanyUrl = normalizeLinkedInUrl(companyLinkedInUrl);

  // Check cache first
  const { data: existing } = await supabaseAdmin
    .from("enriched_companies")
    .select("id, enriched_at")
    .eq("linkedin_url", normalizedCompanyUrl)
    .maybeSingle();

  if (existing && isFresh(existing.enriched_at)) {
    console.log("ENRICH COMPANY CACHE HIT:", normalizedCompanyUrl);
    return existing; // already fresh
  }

  console.log("ENRICH COMPANY CACHE MISS:", normalizedCompanyUrl, "— calling EnrichLayer");

  const url =
    `https://enrichlayer.com/api/v2/company` +
    `?url=${encodeURIComponent(normalizedCompanyUrl)}` +
    `&funding_data=include&extra=include&use_cache=if-present`;

  const response = await fetchWithRetry(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${ENRICHLAYER_API_KEY}` },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error("ENRICHLAYER COMPANY ERROR:", {
      companyLinkedInUrl,
      status: response.status,
      body: errorBody.slice(0, 500),
    });
    return null;
  }

  const r = await response.json();

  const latestRound = (r.funding_data as any[])?.[0];
  const announcedDate = latestRound?.announced_date;
  let latestFundingDate: string | null = null;
  if (announcedDate?.year) {
    const m = String(announcedDate.month || 1).padStart(2, "0");
    const d = String(announcedDate.day || 1).padStart(2, "0");
    latestFundingDate = `${announcedDate.year}-${m}-${d}`;
  }

  const companyData: Record<string, unknown> = {
    linkedin_url: normalizedCompanyUrl,
    linkedin_internal_id: r.linkedin_internal_id,
    universal_name_id: r.universal_name_id,
    name: r.name,
    description: r.description,
    tagline: r.tagline,
    website: r.website,
    profile_pic_url: r.profile_pic_url,
    background_cover_image_url: r.background_cover_image_url,

    industry: r.industry,
    company_type: r.company_type,
    categories: r.categories,
    specialities: r.specialities,

    company_size: r.company_size,
    company_size_min: (r.company_size as number[])?.[0] ?? null,
    company_size_max: (r.company_size as number[])?.[1] ?? null,
    follower_count: r.follower_count,

    hq: r.hq,
    hq_country: (r.hq as any)?.country,
    hq_city: (r.hq as any)?.city,
    hq_state: (r.hq as any)?.state,
    hq_address: (r.hq as any)?.line_1,
    hq_postal_code: (r.hq as any)?.postal_code,
    locations: r.locations,

    founded_year: r.founded_year,
    founding_date: (r.extra as any)?.founding_date,

    funding_data: r.funding_data,
    total_funding_amount: (r.extra as any)?.total_funding_amount,
    number_of_funding_rounds: (r.extra as any)?.number_of_funding_rounds,
    number_of_investors: (r.extra as any)?.number_of_investors,
    latest_funding_round: latestRound || null,
    latest_funding_date: latestFundingDate,
    latest_funding_amount: latestRound?.money_raised ?? null,
    latest_funding_type:
      latestRound?.funding_type?.split(" - ")?.[0] ?? null,

    ipo_status: (r.extra as any)?.ipo_status,
    stock_symbol: (r.extra as any)?.stock_symbol,
    crunchbase_rank: (r.extra as any)?.crunchbase_rank,

    acquisitions: r.acquisitions,
    acquired_by: (r.acquisitions as any)?.acquired_by,
    exit_data: r.exit_data,

    crunchbase_url: (r.extra as any)?.crunchbase_profile_url,
    search_id: r.search_id,

    raw_data: r,
    enriched_at: new Date().toISOString(),
    enrichment_source: "enrichlayer",
  };

  const { error: upsertError } = await supabaseAdmin
    .from("enriched_companies")
    .upsert(companyData, { onConflict: "linkedin_url" });

  if (upsertError) {
    console.error("ENRICH: Company upsert failed:", {
      companyLinkedInUrl,
      name: r.name,
      error: upsertError.message,
      code: upsertError.code,
    });
  } else {
    console.log("ENRICH: Company saved:", r.name, companyLinkedInUrl);
  }

  return companyData;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    // Read body first (can only be read once)
    const body = await request.json();
    const { userId, batchSize } = body;

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

    const effectiveBatchSize = batchSize || DEFAULT_BATCH_SIZE;

    // V1: ONE query path for everyone — no subscription/payment gates.
    // Only enrich tier1/tier2 (seniors). tier3/tier4 are already marked 'skipped' by classification.
    const { data: connections, error: fetchError } = await supabaseAdmin
      .from("user_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("enrichment_status", "pending")
      .in("enrichment_tier", ["tier1", "tier2"])
      .order("created_at", { ascending: true })
      .limit(effectiveBatchSize);

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        processed: 0,
        remaining: 0,
        hasMore: false,
        cached: 0,
        freshEnriched: 0,
      });
    }

    // IMMEDIATELY claim these connections — prevent concurrent calls from picking them up
    const connectionIds = connections.map((c: any) => c.id);
    await supabaseAdmin
      .from("user_connections")
      .update({ enrichment_status: "enriching" })
      .in("id", connectionIds);

    let cacheHits = 0;
    let freshCount = 0;

    // Deduplicate person and company enrichment within this batch — if multiple
    // connections share the same LinkedIn URL, only one API call is made.
    const personPromiseMap = new Map<string, Promise<Record<string, unknown> | null>>();
    const companyPromiseMap = new Map<string, Promise<Record<string, unknown> | null>>();

    // Process batch in parallel
    const enrichmentResults = await Promise.allSettled(
      connections.map(async (conn) => {
        const linkedinUrl = normalizeLinkedInUrl(conn.linkedin_url);

        if (!linkedinUrl) {
          await supabaseAdmin
            .from("user_connections")
            .update({ enrichment_status: "skipped" })
            .eq("id", conn.id);
          return { type: "skipped" as const };
        }

        try {
          // Cache check — single query, maybeSingle to avoid error on miss
          const { data: existingProfile, error: cacheError } = await supabaseAdmin
            .from("enriched_profiles")
            .select("id, linkedin_url, enriched_at, current_company_linkedin")
            .eq("linkedin_url", linkedinUrl)
            .maybeSingle();

          if (cacheError) {
            console.error("ENRICH CACHE ERROR:", cacheError.message);
          }

          if (existingProfile && isFresh(existingProfile.enriched_at)) {
            console.log(`ENRICH CACHE HIT: ${conn.first_name} ${conn.last_name} — skipping API call`);

            // Enrich company if needed — deduplicated within batch
            const cachedCompanyUrl = existingProfile.current_company_linkedin;
            if (cachedCompanyUrl) {
              const companyKey = normalizeLinkedInUrl(cachedCompanyUrl);
              try {
                if (!companyPromiseMap.has(companyKey)) {
                  companyPromiseMap.set(companyKey, enrichCompany(cachedCompanyUrl));
                }
                await companyPromiseMap.get(companyKey);
              } catch (err) {
                console.error("ENRICH: Company enrichment failed (cached path):", cachedCompanyUrl, err instanceof Error ? err.message : err);
              }
            }

            await supabaseAdmin
              .from("user_connections")
              .update({ enrichment_status: "cached" })
              .eq("id", conn.id);
            return { type: "cached" as const };
          }

          console.log(`ENRICH CACHE MISS: ${conn.first_name} ${conn.last_name} — calling EnrichLayer`);

          // Call EnrichLayer Person Profile API — deduplicated within batch
          if (!personPromiseMap.has(linkedinUrl)) {
            personPromiseMap.set(
              linkedinUrl,
              enrichProfile(linkedinUrl, conn.id).catch(() => null)
            );
          }
          const enrichedData = await personPromiseMap.get(linkedinUrl)!;

          if (!enrichedData) {
            // Handle failure per-connection (enrichProfile wrote "failed" to the first
            // connection's ID, but this connection may be a duplicate that needs its own update)
            await supabaseAdmin
              .from("user_connections")
              .update({
                enrichment_status: "failed",
                enrichment_error: "Profile not found or private",
              })
              .eq("id", conn.id);
            return { type: "failed" as const };
          }

          // Map and upsert to enriched_profiles
          const profileRow = mapPersonToProfile(linkedinUrl, enrichedData);
          await supabaseAdmin
            .from("enriched_profiles")
            .upsert(profileRow, { onConflict: "linkedin_url" });

          // Company enrichment via EnrichLayer — deduplicated within batch
          const currentRole = getCurrentRole(enrichedData.experiences as any[]);
          const companyUrl = currentRole?.company_linkedin_profile_url;
          if (companyUrl) {
            const companyKey = normalizeLinkedInUrl(companyUrl);
            try {
              if (!companyPromiseMap.has(companyKey)) {
                companyPromiseMap.set(companyKey, enrichCompany(companyUrl));
              }
              await companyPromiseMap.get(companyKey);
            } catch (err) {
              console.error("ENRICH: Company enrichment failed:", companyUrl, err instanceof Error ? (err as Error).message : err);
            }
          }

          await supabaseAdmin
            .from("user_connections")
            .update({ enrichment_status: "enriched" })
            .eq("id", conn.id);

          return { type: "enriched" as const };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error(`ENRICH ERROR for ${conn.first_name} ${conn.last_name}:`, message);

          // Set to 'failed', NOT 'pending' — prevents infinite retry loop
          await supabaseAdmin
            .from("user_connections")
            .update({
              enrichment_status: "failed",
              enrichment_error: message.slice(0, 500),
            })
            .eq("id", conn.id);

          return { type: "failed" as const };
        }
      })
    );

    for (const result of enrichmentResults) {
      if (result.status === "fulfilled") {
        if (result.value.type === "cached") cacheHits++;
        if (result.value.type === "enriched") freshCount++;
      }
    }

    // Count remaining (tier1/tier2 still pending)
    const { count: remaining } = await supabaseAdmin
      .from("user_connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("enrichment_status", "pending")
      .in("enrichment_tier", ["tier1", "tier2"]);

    // Total eligible = all tier1/tier2 (any enrichment status)
    const { count: totalEligible } = await supabaseAdmin
      .from("user_connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("enrichment_tier", ["tier1", "tier2"])
      .in("enrichment_status", ["enriched", "cached", "pending", "enriching", "failed"]);

    const enrichedSoFar = (totalEligible || 0) - (remaining || 0);
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
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
