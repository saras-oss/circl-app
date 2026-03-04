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

    const { data: authUser } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("id", user.id)
      .single();

    if (!authUser || !ADMIN_EMAILS.includes(authUser.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const page = parseInt(params.get("page") || "1", 10);
    const userEmail = params.get("user_email");
    const enrichmentStatus = params.get("enrichment_status");
    const seniorityTier = params.get("seniority_tier");
    const enrichmentTier = params.get("enrichment_tier");
    const search = params.get("search");
    const scoredOnly = params.get("scored_only") === "true";
    const hitListOnly = params.get("hit_list_only") === "true";
    const enrichedOnly = params.get("enriched_only") === "true";

    // Get all users for mapping
    const { data: allUsers } = await supabaseAdmin
      .from("users")
      .select("id, email, full_name, company_name");

    const userMap = new Map(
      (allUsers || []).map((u) => [
        u.id,
        { email: u.email, name: u.full_name || u.email, company: u.company_name || "" },
      ])
    );

    // Build connection query — lightweight, NO enriched data joins
    let query = supabaseAdmin
      .from("user_connections")
      .select(
        "id, user_id, first_name, last_name, position, company, linkedin_url, connected_on, seniority_tier, function_category, enrichment_tier, enrichment_status, enrichment_error, match_score, match_type, match_reasons, suggested_approach, scored_at",
        { count: "exact" }
      )
      .order("match_score", { ascending: false, nullsFirst: false });

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
    if (enrichmentTier) {
      query = query.eq("enrichment_tier", enrichmentTier);
    }
    if (scoredOnly) {
      query = query.not("match_score", "is", null);
    }
    if (hitListOnly) {
      query = query.gte("match_score", 7);
    }
    if (enrichedOnly) {
      query = query.in("enrichment_status", ["enriched", "cached"]);
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

    // Map connections with user info (no enriched data — loaded on-demand)
    const result = (connections || []).map((conn) => {
      const userInfo = userMap.get(conn.user_id) || {
        email: "unknown",
        name: "Unknown",
        company: "",
      };
      return {
        ...conn,
        user_email: userInfo.email,
        user_name: userInfo.name,
        user_company: userInfo.company,
      };
    });

    // Stats — separate query for global accuracy
    const { data: allConns } = await supabaseAdmin
      .from("user_connections")
      .select("user_id, enrichment_status, enrichment_tier, seniority_tier, match_score");

    const total = (allConns || []).length;
    const enriched = (allConns || []).filter(
      (c) => c.enrichment_status === "enriched" || c.enrichment_status === "cached"
    ).length;
    const scored = (allConns || []).filter((c) => c.match_score !== null).length;
    const hits = (allConns || []).filter(
      (c) => c.match_score !== null && c.match_score >= 7
    ).length;
    const misses = scored - hits;

    // By user
    const userCounts: Record<string, number> = {};
    for (const c of allConns || []) {
      userCounts[c.user_id] = (userCounts[c.user_id] || 0) + 1;
    }
    const byUser = Object.entries(userCounts).map(([uid, cnt]) => {
      const info = userMap.get(uid) || { email: "unknown", name: "Unknown", company: "" };
      return { email: info.email, name: info.name, company: info.company, count: cnt };
    });

    return NextResponse.json({
      connections: result,
      stats: {
        total,
        enriched,
        scored,
        hits,
        misses,
        by_user: byUser,
      },
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
