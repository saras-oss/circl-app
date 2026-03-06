import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { page } = await request.json();

    if (!page || typeof page !== "string") {
      return NextResponse.json({ error: "Invalid page" }, { status: 400 });
    }

    await supabaseAdmin.from("user_activity").insert({
      user_id: user.id,
      page,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Non-fatal
  }
}
