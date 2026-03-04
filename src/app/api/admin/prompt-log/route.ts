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

    // Build filter: user_prompt ILIKE '%{first_name}%' AND user_prompt ILIKE '%{company}%'
    let query = supabaseAdmin
      .from("prompt_runs")
      .select(
        "id, prompt_type, model, user_prompt, response, input_tokens, output_tokens, duration_ms, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(10);

    if (promptType) {
      query = query.eq("prompt_type", promptType);
    }

    // Supabase doesn't support AND on the same column with ilike directly via chaining,
    // so we use .ilike() for each term
    if (firstName) {
      query = query.ilike("user_prompt", `%${firstName}%`);
    }
    if (company) {
      query = query.ilike("user_prompt", `%${company}%`);
    }

    const { data: prompts, error: fetchError } = await query;

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
