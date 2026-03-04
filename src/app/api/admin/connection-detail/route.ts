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

    const { data: authUser } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("id", user.id)
      .single();

    if (!authUser || !ADMIN_EMAILS.includes(authUser.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const connectionId = request.nextUrl.searchParams.get("connection_id");
    if (!connectionId) {
      return NextResponse.json({ error: "Missing connection_id" }, { status: 400 });
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

    // Get enriched profile — FULL row including raw_data
    const { data: profile } = connection.linkedin_url
      ? await supabaseAdmin
          .from("enriched_profiles")
          .select("*")
          .eq("linkedin_url", connection.linkedin_url)
          .limit(1)
          .single()
      : { data: null };

    // Get enriched company — FULL row including raw_data
    const { data: company } = profile?.current_company_linkedin
      ? await supabaseAdmin
          .from("enriched_companies")
          .select("*")
          .eq("linkedin_url", profile.current_company_linkedin)
          .limit(1)
          .single()
      : { data: null };

    return NextResponse.json({
      connection,
      enriched_profile: profile,
      enriched_company: company,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
