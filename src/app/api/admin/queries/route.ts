import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ADMIN_EMAILS = ["saras@incommon.ai", "piyush@incommon.ai"];

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminCheck } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("id", user.id)
      .single();

    if (!adminCheck || !ADMIN_EMAILS.includes(adminCheck.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "7", 10);
    const userIdFilter = searchParams.get("user_id") || "";
    const since = new Date();
    since.setDate(since.getDate() - days);

    let query = supabaseAdmin
      .from("query_log")
      .select("*")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(200);

    if (userIdFilter) {
      query = query.eq("user_id", userIdFilter);
    }

    const { data: queryRows } = await query;

    // Fetch user names
    const userIds = [...new Set((queryRows || []).map((q) => q.user_id))];
    const { data: userRows } = await supabaseAdmin
      .from("users")
      .select("id, full_name, email, company_name")
      .in("id", userIds.length > 0 ? userIds : ["__none__"]);

    const userMap = new Map(
      (userRows || []).map((u) => [u.id, u])
    );

    const queries = (queryRows || []).map((q) => {
      const u = userMap.get(q.user_id);
      return {
        id: q.id,
        user_id: q.user_id,
        full_name: u?.full_name || "",
        company_name: u?.company_name || "",
        question: q.question || "",
        display_type: q.display_type || "",
        results_count: q.results_count || 0,
        answer_preview: q.answer_preview || "",
        follow_ups: q.follow_ups || [],
        duration_ms: q.duration_ms || 0,
        created_at: q.created_at,
      };
    });

    // Stats
    const totalQueries = queries.length;
    const avgResults =
      totalQueries > 0
        ? Math.round(queries.reduce((a, q) => a + q.results_count, 0) / totalQueries)
        : 0;

    // Most active user
    const userQueryCounts = new Map<string, { name: string; count: number }>();
    for (const q of queries) {
      const existing = userQueryCounts.get(q.user_id);
      if (existing) {
        existing.count++;
      } else {
        userQueryCounts.set(q.user_id, { name: q.full_name || "Unknown", count: 1 });
      }
    }
    let mostActiveUser = "";
    let maxCount = 0;
    for (const [, v] of userQueryCounts) {
      if (v.count > maxCount) {
        maxCount = v.count;
        mostActiveUser = v.name;
      }
    }

    // Query type breakdown
    const queryTypeBreakdown = { filter: 0, person_lookup: 0, aggregation: 0, general: 0 };
    for (const q of queries) {
      const dt = q.display_type;
      if (dt === "table" || dt === "cards") queryTypeBreakdown.filter++;
      else if (dt === "profile") queryTypeBreakdown.person_lookup++;
      else if (dt === "chart") queryTypeBreakdown.aggregation++;
      else queryTypeBreakdown.general++;
    }

    return NextResponse.json({
      queries,
      total_queries: totalQueries,
      avg_results: avgResults,
      most_active_user: mostActiveUser,
      query_type_breakdown: queryTypeBreakdown,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
