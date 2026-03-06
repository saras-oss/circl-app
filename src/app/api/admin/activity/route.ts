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
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();

    // Fetch all users
    const { data: allUsers } = await supabaseAdmin
      .from("users")
      .select("id, email, full_name, company_name, created_at, total_connections")
      .order("created_at", { ascending: false });

    // Fetch page views in period
    const { data: pageViews } = await supabaseAdmin
      .from("user_activity")
      .select("user_id, page, created_at")
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: true });

    // Fetch query counts in period
    const { data: queries } = await supabaseAdmin
      .from("query_log")
      .select("user_id, created_at")
      .gte("created_at", sinceISO);

    // Fetch enriched/scored/hits counts per user
    const { data: connectionStats } = await supabaseAdmin
      .from("user_connections")
      .select("user_id, enrichment_status, match_score");

    // Build per-user stats
    const enrichedByUser = new Map<string, number>();
    const hitsByUser = new Map<string, number>();
    for (const c of connectionStats || []) {
      if (c.enrichment_status === "enriched" || c.enrichment_status === "cached") {
        enrichedByUser.set(c.user_id, (enrichedByUser.get(c.user_id) || 0) + 1);
      }
      if (c.match_score != null && c.match_score >= 7) {
        hitsByUser.set(c.user_id, (hitsByUser.get(c.user_id) || 0) + 1);
      }
    }

    // Build per-user page view counts
    const viewsByUser = new Map<string, { page: string; created_at: string }[]>();
    for (const pv of pageViews || []) {
      const existing = viewsByUser.get(pv.user_id) || [];
      existing.push({ page: pv.page, created_at: pv.created_at });
      viewsByUser.set(pv.user_id, existing);
    }

    // Query counts per user
    const queryCountByUser = new Map<string, number>();
    for (const q of queries || []) {
      queryCountByUser.set(q.user_id, (queryCountByUser.get(q.user_id) || 0) + 1);
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let activeToday = 0;
    let activeThisWeek = 0;

    const users = (allUsers || []).map((u) => {
      const views = viewsByUser.get(u.id) || [];
      const pageViewCounts: Record<string, number> = {};
      let lastSeen: string | null = null;

      for (const v of views) {
        pageViewCounts[v.page] = (pageViewCounts[v.page] || 0) + 1;
        if (!lastSeen || v.created_at > lastSeen) lastSeen = v.created_at;
      }

      // Session grouping: gap > 30 min = new session
      const sessions: { started: string; pages: string[]; duration_minutes: number }[] = [];
      if (views.length > 0) {
        let sessionStart = views[0].created_at;
        let sessionPages = [views[0].page];
        let prevTime = new Date(views[0].created_at).getTime();

        for (let i = 1; i < views.length; i++) {
          const t = new Date(views[i].created_at).getTime();
          if (t - prevTime > 30 * 60 * 1000) {
            // New session
            sessions.push({
              started: sessionStart,
              pages: sessionPages,
              duration_minutes: Math.round((prevTime - new Date(sessionStart).getTime()) / 60000),
            });
            sessionStart = views[i].created_at;
            sessionPages = [views[i].page];
          } else {
            sessionPages.push(views[i].page);
          }
          prevTime = t;
        }
        sessions.push({
          started: sessionStart,
          pages: sessionPages,
          duration_minutes: Math.round((prevTime - new Date(sessionStart).getTime()) / 60000),
        });
      }

      if (lastSeen && lastSeen >= todayStart) activeToday++;
      if (lastSeen && lastSeen >= weekStart) activeThisWeek++;

      return {
        user_id: u.id,
        full_name: u.full_name || "",
        email: u.email || "",
        company_name: u.company_name || "",
        joined: u.created_at,
        last_seen: lastSeen,
        total_connections: u.total_connections || 0,
        enriched_count: enrichedByUser.get(u.id) || 0,
        hits_count: hitsByUser.get(u.id) || 0,
        page_views: pageViewCounts,
        total_views: views.length,
        query_count: queryCountByUser.get(u.id) || 0,
        sessions: sessions.slice(-10).reverse(), // last 10 sessions, newest first
      };
    });

    // Sort by last_seen desc (active users first)
    users.sort((a, b) => {
      if (!a.last_seen && !b.last_seen) return 0;
      if (!a.last_seen) return 1;
      if (!b.last_seen) return -1;
      return b.last_seen.localeCompare(a.last_seen);
    });

    return NextResponse.json({
      users,
      total_users: allUsers?.length || 0,
      active_today: activeToday,
      active_this_week: activeThisWeek,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
