import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user actually exists in auth.users (JWT may outlive a deleted user)
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user.id);
    if (!authUser?.user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    // Upsert: create row if missing, do nothing if it exists
    const { error } = await supabaseAdmin.from("users").upsert(
      {
        id: user.id,
        email: user.email,
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
