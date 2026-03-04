import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId || userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Run all queries in parallel
    const [
      totalResult,
      enrichedResult,
      seniorityResult,
      connectionsResult,
      profilesResult,
      companiesResult,
      scoredResult,
    ] = await Promise.all([
      // Total connections
      supabaseAdmin
        .from("user_connections")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),

      // Enriched count
      supabaseAdmin
        .from("user_connections")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("enrichment_status", ["enriched", "cached"]),

      // Seniority breakdown
      supabaseAdmin
        .from("user_connections")
        .select("seniority_tier")
        .eq("user_id", userId)
        .not("seniority_tier", "is", null),

      // All connections for timeline + company grouping
      supabaseAdmin
        .from("user_connections")
        .select("company, connected_on, linkedin_url")
        .eq("user_id", userId),

      // Enriched profiles for geo + education + experience
      supabaseAdmin
        .from("enriched_profiles")
        .select(
          "linkedin_url, country_full_name, country, education_schools, total_experience_years, full_name, current_title, current_company, current_company_linkedin, industry"
        )
        .in(
          "linkedin_url",
          // sub-select: get linkedin_urls for this user
          (
            await supabaseAdmin
              .from("user_connections")
              .select("linkedin_url")
              .eq("user_id", userId)
              .not("linkedin_url", "is", null)
              .not("linkedin_url", "eq", "")
          ).data?.map((c) => c.linkedin_url) || []
        ),

      // Enriched companies for funding + industry
      supabaseAdmin
        .from("enriched_companies")
        .select(
          "linkedin_url, name, industry, company_size_min, company_size_max, latest_funding_type, latest_funding_amount, latest_funding_date, total_funding_amount, hq_city, hq_country"
        ),

      // Scored count
      supabaseAdmin
        .from("user_connections")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("match_score", "is", null),
    ]);

    const totalConnections = totalResult.count || 0;
    const enrichedCount = enrichedResult.count || 0;
    const scoredCount = scoredResult.count || 0;
    const connections = connectionsResult.data || [];
    const profiles = profilesResult.data || [];
    const allCompanies = companiesResult.data || [];

    // Build company lookup
    const companyMap = new Map(allCompanies.map((c) => [c.linkedin_url, c]));

    // Seniority breakdown
    const seniorityMap = new Map<string, number>();
    for (const row of seniorityResult.data || []) {
      const tier = row.seniority_tier || "Other";
      seniorityMap.set(tier, (seniorityMap.get(tier) || 0) + 1);
    }
    const seniority_breakdown = [...seniorityMap.entries()]
      .map(([tier, count]) => ({ tier, count }))
      .sort((a, b) => b.count - a.count);

    // Industry breakdown (from enriched profiles/companies)
    const industryMap = new Map<string, number>();
    for (const p of profiles) {
      const comp = p.current_company_linkedin
        ? companyMap.get(p.current_company_linkedin)
        : null;
      const industry = comp?.industry || p.industry || null;
      if (industry) {
        industryMap.set(industry, (industryMap.get(industry) || 0) + 1);
      }
    }
    const industry_breakdown = [...industryMap.entries()]
      .map(([industry, count]) => ({ industry, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Geo breakdown
    const geoMap = new Map<string, number>();
    for (const p of profiles) {
      const country = p.country_full_name || p.country || null;
      if (country) {
        geoMap.set(country, (geoMap.get(country) || 0) + 1);
      }
    }
    const geo_breakdown = [...geoMap.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Connection timeline
    const timelineMap = new Map<string, number>();
    for (const c of connections) {
      if (c.connected_on) {
        // Parse date to get year-month
        const date = new Date(c.connected_on);
        if (!isNaN(date.getTime())) {
          const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          timelineMap.set(period, (timelineMap.get(period) || 0) + 1);
        }
      }
    }
    const timeline = [...timelineMap.entries()]
      .map(([period, count]) => ({ period, count }))
      .sort((a, b) => a.period.localeCompare(b.period));

    // Top companies
    const companyCountMap = new Map<string, number>();
    for (const c of connections) {
      if (c.company) {
        companyCountMap.set(
          c.company,
          (companyCountMap.get(c.company) || 0) + 1
        );
      }
    }
    const top_companies = [...companyCountMap.entries()]
      .map(([company, count]) => {
        // Find enriched company data if available
        const enriched = allCompanies.find(
          (ec) =>
            ec.name?.toLowerCase() === company.toLowerCase()
        );
        return {
          company,
          count,
          industry: enriched?.industry || undefined,
          employee_count: enriched?.company_size_min || undefined,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top schools
    const schoolMap = new Map<string, number>();
    for (const p of profiles) {
      const schools = p.education_schools as string[] | null;
      if (schools) {
        for (const school of schools) {
          if (school) {
            schoolMap.set(school, (schoolMap.get(school) || 0) + 1);
          }
        }
      }
    }
    const top_schools = [...schoolMap.entries()]
      .map(([school, count]) => ({ school, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Funding signals (companies with recent funding)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const funding_signals = allCompanies
      .filter((c) => {
        if (!c.latest_funding_date) return false;
        const d = new Date(c.latest_funding_date);
        return d >= oneYearAgo;
      })
      .map((c) => ({
        company: c.name || "Unknown",
        funding_type: c.latest_funding_type || "",
        amount: c.latest_funding_amount || 0,
        date: c.latest_funding_date || "",
      }))
      .slice(0, 5);

    // Experience stats
    const experienceYears = profiles
      .map((p) => p.total_experience_years as number | null)
      .filter((y): y is number => y != null && y > 0);

    const avgYears =
      experienceYears.length > 0
        ? Math.round(
            experienceYears.reduce((a, b) => a + b, 0) /
              experienceYears.length
          )
        : 0;
    const maxYears = experienceYears.length > 0 ? Math.max(...experienceYears) : 0;
    const maxPerson = profiles.find(
      (p) => p.total_experience_years === maxYears
    );

    // Histogram buckets
    const buckets = [
      { label: "0-5", min: 0, max: 5 },
      { label: "5-10", min: 5, max: 10 },
      { label: "10-15", min: 10, max: 15 },
      { label: "15-20", min: 15, max: 20 },
      { label: "20-25", min: 20, max: 25 },
      { label: "25-30", min: 25, max: 30 },
      { label: "30+", min: 30, max: 999 },
    ];
    const histogram = buckets.map((b) => ({
      bucket: b.label,
      count: experienceYears.filter((y) => y >= b.min && y < b.max).length,
    }));

    return NextResponse.json({
      total_connections: totalConnections,
      enriched_count: enrichedCount,
      scored_count: scoredCount,
      seniority_breakdown,
      industry_breakdown,
      geo_breakdown,
      timeline,
      top_companies,
      top_schools,
      funding_signals,
      experience_stats: {
        avg_years: avgYears,
        max_years: maxYears,
        max_person: maxPerson
          ? `${maxPerson.full_name} (${maxPerson.current_title} at ${maxPerson.current_company})`
          : null,
        histogram,
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
