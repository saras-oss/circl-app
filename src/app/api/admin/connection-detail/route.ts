import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ADMIN_EMAILS = ["saras@incommon.ai", "piyush@incommon.ai"];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("id", user.id)
      .single();

    if (!userData || !ADMIN_EMAILS.includes(userData.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const connectionId = request.nextUrl.searchParams.get("id");
    if (!connectionId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    // Get full connection data
    const { data: connection, error: connError } = await supabaseAdmin
      .from("user_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connError || !connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    // Get enriched profile
    const { data: profile } = connection.linkedin_url
      ? await supabaseAdmin
          .from("enriched_profiles")
          .select("*")
          .eq("linkedin_url", connection.linkedin_url)
          .limit(1)
          .single()
      : { data: null };

    // Get enriched company
    const { data: company } = profile?.current_company_linkedin
      ? await supabaseAdmin
          .from("enriched_companies")
          .select("*")
          .eq("linkedin_url", profile.current_company_linkedin)
          .limit(1)
          .single()
      : { data: null };

    // Get prompt runs that mention this connection
    const searchTerms = [
      connection.first_name && connection.last_name
        ? `${connection.first_name} ${connection.last_name}`
        : null,
      connection.company,
    ].filter(Boolean);

    let prompts = null;
    if (searchTerms.length > 0) {
      const orFilter = searchTerms
        .map((term) => `user_prompt.ilike.%${term}%`)
        .join(",");
      const { data } = await supabaseAdmin
        .from("prompt_runs")
        .select(
          "id, prompt_type, model, user_prompt, response, input_tokens, output_tokens, duration_ms, created_at"
        )
        .eq("user_id", connection.user_id)
        .or(orFilter)
        .order("created_at", { ascending: false })
        .limit(5);
      prompts = data;
    }

    // Strip raw_data from profile/company to avoid huge payloads, but keep everything else
    const cleanProfile = profile
      ? { ...profile, raw_data: undefined }
      : null;
    const cleanCompany = company
      ? { ...company, raw_data: undefined }
      : null;

    return NextResponse.json({
      connection,
      enriched_profile: cleanProfile,
      enriched_company: cleanCompany,
      prompt_runs: prompts || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
