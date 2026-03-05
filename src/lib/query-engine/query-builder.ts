/* eslint-disable @typescript-eslint/no-explicit-any */
import { SupabaseClient } from "@supabase/supabase-js";
import { QueryIntent, QueryResult } from "./types";

const FULL_COLUMNS = `
  connection_id, first_name, last_name, csv_company, csv_position,
  connected_on, linkedin_url, seniority_tier, function_category,
  match_score, match_type, match_reasons, suggested_approach,
  headline, current_title, current_company, location_str, city,
  country_full_name, total_experience_years, previous_companies,
  previous_titles, education_schools, follower_count, profile_pic_url,
  company_name, company_description, company_industry, company_specialities,
  company_size_min, company_size_max, company_type, hq_city, hq_country,
  latest_funding_type, latest_funding_amount, total_funding_amount,
  company_logo_url, company_website, enrichment_status, person_summary,
  work_history
`;

/** Escape special characters in ilike patterns */
function escapeIlike(value: string): string {
  return value.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Build OR filter string for ilike across multiple columns */
function buildIlikeOr(columns: string[], keywords: string[]): string {
  return keywords
    .flatMap((kw) => {
      const escaped = escapeIlike(kw);
      return columns.map((col) => `${col}.ilike.%${escaped}%`);
    })
    .join(",");
}

async function executePersonLookup(
  supabase: SupabaseClient,
  userId: string,
  lookup: QueryIntent["person_lookup"]
): Promise<QueryResult> {
  // If no name fields provided at all, return empty — don't fetch everything
  const hasName =
    lookup?.first_name || lookup?.last_name || lookup?.full_name;
  if (!hasName) {
    return {
      data: [],
      count: 0,
      total_available: 0,
      enrichment_coverage: { enriched: 0, total: 0 },
    };
  }

  let query = supabase
    .from("network_view")
    .select(FULL_COLUMNS, { count: "exact" })
    .eq("user_id", userId);

  if (lookup?.first_name && lookup?.last_name) {
    query = query
      .ilike("first_name", `%${escapeIlike(lookup.first_name)}%`)
      .ilike("last_name", `%${escapeIlike(lookup.last_name)}%`);
  } else if (lookup?.full_name) {
    const parts = lookup.full_name.trim().split(/\s+/);
    if (parts.length >= 2) {
      query = query
        .ilike("first_name", `%${escapeIlike(parts[0])}%`)
        .ilike("last_name", `%${escapeIlike(parts[parts.length - 1])}%`);
    } else {
      query = query.or(
        `first_name.ilike.%${escapeIlike(parts[0])}%,last_name.ilike.%${escapeIlike(parts[0])}%`
      );
    }
  } else if (lookup?.first_name) {
    query = query.or(
      `first_name.ilike.%${escapeIlike(lookup.first_name)}%,last_name.ilike.%${escapeIlike(lookup.first_name)}%`
    );
  } else if (lookup?.last_name) {
    query = query.or(
      `first_name.ilike.%${escapeIlike(lookup.last_name)}%,last_name.ilike.%${escapeIlike(lookup.last_name)}%`
    );
  }

  if (lookup?.company) {
    const escaped = escapeIlike(lookup.company);
    query = query.or(
      `csv_company.ilike.%${escaped}%,current_company.ilike.%${escaped}%`
    );
  }

  // Sort by match_score descending so strongest matches appear first
  query = query
    .order("match_score", { ascending: false, nullsFirst: false })
    .limit(10);

  const { data, error, count } = await query;
  if (error) throw new Error(`Person lookup failed: ${error.message}`);

  // Enrichment coverage
  const [{ count: totalConnections }, { count: enrichedConnections }] =
    await Promise.all([
      supabase
        .from("user_connections")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("user_connections")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("enrichment_status", ["enriched", "cached"]),
    ]);

  return {
    data: data || [],
    count: data?.length || 0,
    total_available: count || 0,
    enrichment_coverage: {
      enriched: enrichedConnections || 0,
      total: totalConnections || 0,
    },
  };
}

export async function buildAndExecuteQuery(
  supabase: SupabaseClient,
  userId: string,
  intent: QueryIntent
): Promise<QueryResult> {
  // Person lookup is a separate code path
  if (intent.query_type === "person_lookup") {
    return executePersonLookup(supabase, userId, intent.person_lookup);
  }

  // For aggregation, fetch more rows to compute accurate counts
  const isAggregate = intent.query_type === "aggregate";
  const selectColumns = isAggregate
    ? `${intent.aggregation?.group_by || "seniority_tier"}, match_score, connection_id`
    : FULL_COLUMNS;

  let query = supabase
    .from("network_view")
    .select(selectColumns, { count: "exact" })
    .eq("user_id", userId);

  const f = intent.filters || {};

  // ── Enum filters (exact match) ──
  if (f.seniority_tier?.length)
    query = query.in("seniority_tier", f.seniority_tier);
  if (f.function_category?.length)
    query = query.in("function_category", f.function_category);
  if (f.match_type?.length) query = query.in("match_type", f.match_type);
  if (f.decision_maker_likelihood?.length)
    query = query.in("decision_maker_likelihood", f.decision_maker_likelihood);
  if (f.enrichment_tier?.length)
    query = query.in("enrichment_tier", f.enrichment_tier);
  if (f.company_type?.length)
    query = query.in("company_type", f.company_type);

  // ── Score range ──
  if (f.match_score_min != null)
    query = query.gte("match_score", f.match_score_min);
  if (f.match_score_max != null)
    query = query.lte("match_score", f.match_score_max);

  // ── Numeric ranges ──
  if (f.company_size_min != null)
    query = query.gte("company_size_max", f.company_size_min);
  if (f.company_size_max != null)
    query = query.lte("company_size_min", f.company_size_max);
  if (f.experience_years_min != null)
    query = query.gte("total_experience_years", f.experience_years_min);
  if (f.experience_years_max != null)
    query = query.lte("total_experience_years", f.experience_years_max);
  if (f.funding_amount_min != null)
    query = query.gte("latest_funding_amount", f.funding_amount_min);

  // ── Date ranges ──
  if (f.connected_after) query = query.gte("connected_on", f.connected_after);
  if (f.connected_before)
    query = query.lte("connected_on", f.connected_before);

  // ── Funding stages ──
  if (f.funding_stages?.length) {
    const fundingFilter = f.funding_stages
      .map((stage) => `latest_funding_type.ilike.%${escapeIlike(stage)}%`)
      .join(",");
    query = query.or(fundingFilter);
  }

  // ── Text search filters (ilike OR across multiple columns) ──
  if (f.title_keywords?.length) {
    query = query.or(
      buildIlikeOr(
        ["csv_position", "current_title", "headline"],
        f.title_keywords
      )
    );
  }

  if (f.company_keywords?.length) {
    query = query.or(
      buildIlikeOr(
        ["csv_company", "current_company", "company_name"],
        f.company_keywords
      )
    );
  }

  if (f.company_current_or_previous_keywords?.length) {
    const companyOrPrevFilter = f.company_current_or_previous_keywords
      .map((kw) => {
        const escaped = escapeIlike(kw);
        return [
          `csv_company.ilike.%${escaped}%`,
          `current_company.ilike.%${escaped}%`,
          `company_name.ilike.%${escaped}%`,
          `previous_companies::text.ilike.%${escaped}%`,
        ].join(",");
      })
      .join(",");
    query = query.or(companyOrPrevFilter);
  }

  if (f.industry_keywords?.length) {
    query = query.or(
      buildIlikeOr(
        ["company_industry", "company_description"],
        f.industry_keywords
      )
    );
  }

  if (f.geography_keywords?.length) {
    query = query.or(
      buildIlikeOr(
        ["location_str", "city", "country_full_name", "hq_city", "hq_country"],
        f.geography_keywords
      )
    );
  }

  if (f.school_keywords?.length) {
    // education_schools is JSONB — cast to text for ilike
    const schoolFilter = f.school_keywords
      .map(
        (kw) =>
          `education_schools::text.ilike.%${escapeIlike(kw)}%`
      )
      .join(",");
    query = query.or(schoolFilter);
  }

  if (f.previous_company_keywords?.length) {
    const prevCoFilter = f.previous_company_keywords
      .map(
        (kw) =>
          `previous_companies::text.ilike.%${escapeIlike(kw)}%`
      )
      .join(",");
    query = query.or(prevCoFilter);
  }

  if (f.skill_keywords?.length) {
    query = query.or(
      buildIlikeOr(
        ["headline", "person_summary"],
        f.skill_keywords
      )
    );
  }

  // ── Sorting ──
  if (intent.sort) {
    query = query.order(intent.sort.field, {
      ascending: intent.sort.direction === "asc",
      nullsFirst: false,
    });
  } else {
    query = query
      .order("match_score", { ascending: false, nullsFirst: false })
      .order("connected_on", { ascending: false, nullsFirst: false });
  }

  // ── Limit ──
  const limit = isAggregate
    ? 500 // Need more rows for accurate aggregation
    : Math.min(intent.limit || 20, 50); // Hard cap at 50 for filter
  query = query.limit(limit);

  // ── Execute ──
  const { data, error, count } = await query;
  if (error) throw new Error(`Query failed: ${error.message}`);

  // ── Enrichment coverage ──
  const [{ count: totalConnections }, { count: enrichedConnections }] =
    await Promise.all([
      supabase
        .from("user_connections")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("user_connections")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("enrichment_status", ["enriched", "cached"]),
    ]);

  return {
    data: data || [],
    count: data?.length || 0,
    total_available: count || 0,
    enrichment_coverage: {
      enriched: enrichedConnections || 0,
      total: totalConnections || 0,
    },
  };
}
