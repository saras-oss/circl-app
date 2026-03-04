import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ADMIN_EMAILS = ["saras@incommon.ai", "piyush@incommon.ai"];
const PER_PAGE = 20;

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

    const params = request.nextUrl.searchParams;
    const page = parseInt(params.get("page") || "1", 10);
    const userId = params.get("user_id");
    const search = params.get("search");
    const promptType = params.get("prompt_type");

    let query = supabaseAdmin
      .from("prompt_runs")
      .select(
        "id, prompt_type, model, user_prompt, response, input_tokens, output_tokens, duration_ms, created_at, user_id",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (userId) {
      query = query.eq("user_id", userId);
    }
    if (promptType) {
      query = query.eq("prompt_type", promptType);
    }
    if (search) {
      query = query.or(
        `user_prompt.ilike.%${search}%,response.ilike.%${search}%`
      );
    }

    const from = (page - 1) * PER_PAGE;
    query = query.range(from, from + PER_PAGE - 1);

    const { data: prompts, count, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({
      prompts: prompts || [],
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
