import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ADMIN_EMAILS = ["saras@incommon.ai", "piyush@incommon.ai"];
const PER_PAGE = 50;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("id", user.id)
      .single();

    if (!userData || !ADMIN_EMAILS.includes(userData.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const page = parseInt(params.get("page") || "1", 10);
    const userEmail = params.get("user_email");
    const enrichmentStatus = params.get("enrichment_status");
    const seniorityTier = params.get("seniority_tier");
    const search = params.get("search");
    const scoredOnly = params.get("scored_only") === "true";
    const hitListOnly = params.get("hit_list_only") === "true";

    // Get all users for mapping
    const { data: allUsers } = await supabaseAdmin
      .from("users")
      .select("id, email, company_name");

    const userMap = new Map(
      (allUsers || []).map((u) => [u.id, { email: u.email, company: u.company_name }])
    );

    // Build connection query
    let query = supabaseAdmin
      .from("user_connections")
      .select(
        "id, user_id, first_name, last_name, position, company, linkedin_url, connected_on, seniority_tier, function_category, enrichment_tier, enrichment_status, enrichment_error, match_score, match_type, match_reasons, suggested_approach, scored_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // Apply filters
    if (userEmail) {
      const matchingUser = (allUsers || []).find((u) => u.email === userEmail);
      if (matchingUser) {
        query = query.eq("user_id", matchingUser.id);
      }
    }
    if (enrichmentStatus) {
      query = query.eq("enrichment_status", enrichmentStatus);
    }
    if (seniorityTier) {
      query = query.eq("seniority_tier", seniorityTier);
    }
    if (scoredOnly) {
      query = query.not("match_score", "is", null);
    }
    if (hitListOnly) {
      query = query.gte("match_score", 7);
    }
    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,company.ilike.%${search}%,position.ilike.%${search}%`
      );
    }

    // Paginate
    const from = (page - 1) * PER_PAGE;
    query = query.range(from, from + PER_PAGE - 1);

    const { data: connections, count, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Get enriched profiles for these connections
    const linkedinUrls = (connections || [])
      .map((c) => c.linkedin_url)
      .filter(Boolean) as string[];

    const { data: profiles } =
      linkedinUrls.length > 0
        ? await supabaseAdmin
            .from("enriched_profiles")
            .select(
              "linkedin_url, headline, current_title, current_company, current_company_linkedin, location_str, total_experience_years, industry, follower_count, connections_count"
            )
            .in("linkedin_url", linkedinUrls)
        : { data: [] };

    const profileMap = new Map(
      (profiles || []).map((p) => [p.linkedin_url, p])
    );

    // Get enriched companies
    const companyUrls = (profiles || [])
      .map((p) => p.current_company_linkedin)
      .filter(Boolean) as string[];

    const { data: companies } =
      companyUrls.length > 0
        ? await supabaseAdmin
            .from("enriched_companies")
            .select(
              "linkedin_url, name, industry, description, company_size_min, company_size_max, hq_city, hq_country, latest_funding_type, total_funding_amount"
            )
            .in("linkedin_url", companyUrls)
        : { data: [] };

    const companyMap = new Map(
      (companies || []).map((c) => [c.linkedin_url, c])
    );

    // Build response
    const result = (connections || []).map((conn) => {
      const userInfo = userMap.get(conn.user_id) || {
        email: "unknown",
        company: "unknown",
      };
      const profile = profileMap.get(conn.linkedin_url || "");
      const company = profile?.current_company_linkedin
        ? companyMap.get(profile.current_company_linkedin)
        : null;

      return {
        id: conn.id,
        first_name: conn.first_name,
        last_name: conn.last_name,
        position: conn.position,
        company: conn.company,
        linkedin_url: conn.linkedin_url,
        connected_on: conn.connected_on,
        seniority_tier: conn.seniority_tier,
        function_category: conn.function_category,
        enrichment_tier: conn.enrichment_tier,
        enrichment_status: conn.enrichment_status,
        enrichment_error: conn.enrichment_error,
        match_score: conn.match_score,
        match_type: conn.match_type,
        match_reasons: conn.match_reasons,
        suggested_approach: conn.suggested_approach,
        scored_at: conn.scored_at,
        user_email: userInfo.email,
        user_company: userInfo.company,
        enriched_profile: profile
          ? {
              headline: profile.headline,
              current_title: profile.current_title,
              current_company: profile.current_company,
              location_str: profile.location_str,
              total_experience_years: profile.total_experience_years,
              industry: profile.industry,
              follower_count: profile.follower_count,
              connections_count: profile.connections_count,
            }
          : null,
        enriched_company: company
          ? {
              name: company.name,
              industry: company.industry,
              description: (company.description as string)?.slice(0, 300) || null,
              company_size_min: company.company_size_min,
              company_size_max: company.company_size_max,
              hq_city: company.hq_city,
              hq_country: company.hq_country,
              latest_funding_type: company.latest_funding_type,
              total_funding_amount: company.total_funding_amount,
            }
          : null,
      };
    });

    // Stats — use separate queries for accuracy
    const { data: allConns } = await supabaseAdmin
      .from("user_connections")
      .select("user_id, enrichment_status, enrichment_tier, seniority_tier, match_score");

    const stats = {
      total_connections: (allConns || []).length,
      classified: (allConns || []).filter((c) => c.seniority_tier).length,
      enriched: (allConns || []).filter(
        (c) => c.enrichment_status === "enriched" || c.enrichment_status === "cached"
      ).length,
      scored: (allConns || []).filter((c) => c.match_score !== null).length,
      hit_list: (allConns || []).filter(
        (c) => c.match_score !== null && c.match_score >= 7
      ).length,
      by_user: [] as { email: string; company: string; count: number }[],
      by_status: [] as { status: string; count: number }[],
      by_tier: [] as { tier: string; count: number }[],
    };

    // By user
    const userCounts: Record<string, number> = {};
    for (const c of allConns || []) {
      userCounts[c.user_id] = (userCounts[c.user_id] || 0) + 1;
    }
    stats.by_user = Object.entries(userCounts).map(([uid, cnt]) => {
      const info = userMap.get(uid) || { email: "unknown", company: "unknown" };
      return { email: info.email, company: info.company || "", count: cnt };
    });

    // By status
    const statusCounts: Record<string, number> = {};
    for (const c of allConns || []) {
      const s = c.enrichment_status || "null";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }
    stats.by_status = Object.entries(statusCounts).map(([status, cnt]) => ({
      status,
      count: cnt,
    }));

    // By tier
    const tierCounts: Record<string, number> = {};
    for (const c of allConns || []) {
      const t = c.seniority_tier || "unclassified";
      tierCounts[t] = (tierCounts[t] || 0) + 1;
    }
    stats.by_tier = Object.entries(tierCounts).map(([tier, cnt]) => ({
      tier,
      count: cnt,
    }));

    return NextResponse.json({
      connections: result,
      stats,
      pagination: {
        page,
        per_page: PER_PAGE,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / PER_PAGE),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
