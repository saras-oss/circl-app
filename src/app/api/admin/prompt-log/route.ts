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

    const params = request.nextUrl.searchParams;
    const firstName = params.get("first_name");
    const company = params.get("company");
    const promptType = params.get("prompt_type");

    if (!firstName && !company) {
      return NextResponse.json({ error: "Provide first_name or company" }, { status: 400 });
    }

    console.log("PROMPT_LOG: Searching for", { firstName, company, promptType });

    // Search by prompt_type (try both "scoring" and "matching" for backwards compat)
    // Then OR-match on first_name or company in user_prompt
    const orParts: string[] = [];
    if (firstName) orParts.push(`user_prompt.ilike.%${firstName}%`);
    if (company) orParts.push(`user_prompt.ilike.%${company}%`);

    let query = supabaseAdmin
      .from("prompt_runs")
      .select(
        "id, prompt_type, model, user_prompt, response, input_tokens, output_tokens, duration_ms, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(5);

    if (promptType) {
      // Search both the requested type and common aliases
      const types = [promptType];
      if (promptType === "matching") types.push("scoring");
      if (promptType === "scoring") types.push("matching");
      query = query.in("prompt_type", types);
    }

    if (orParts.length > 0) {
      query = query.or(orParts.join(","));
    }

    const { data: prompts, error: fetchError } = await query;

    console.log("PROMPT_LOG: Found", prompts?.length, "results");

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({
      prompts: prompts || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
