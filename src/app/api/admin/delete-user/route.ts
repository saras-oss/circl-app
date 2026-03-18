import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ADMIN_EMAILS = ["saras@incommon.ai", "piyush@incommon.ai"];

async function checkAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized", status: 401 };

  const { data: authUser } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("id", user.id)
    .single();

  if (!authUser || !ADMIN_EMAILS.includes(authUser.email)) {
    return { error: "Forbidden", status: 403 };
  }

  return { error: null, status: 200 };
}

export async function POST(request: Request) {
  try {
    const auth = await checkAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Safety: prevent deleting admin accounts
    const { data: targetUser } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("id", userId)
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (ADMIN_EMAILS.includes(targetUser.email)) {
      return NextResponse.json(
        { error: "Cannot delete admin accounts" },
        { status: 403 }
      );
    }

    // Delete child tables first (order matters for foreign keys)

    // 1. user_connections
    const { count: connectionsCount } = await supabaseAdmin
      .from("user_connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    await supabaseAdmin
      .from("user_connections")
      .delete()
      .eq("user_id", userId);

    // 2. pipeline_jobs
    const { count: pipelineJobsCount } = await supabaseAdmin
      .from("pipeline_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    await supabaseAdmin
      .from("pipeline_jobs")
      .delete()
      .eq("user_id", userId);

    // 3. prompt_runs
    const { count: promptRunsCount } = await supabaseAdmin
      .from("prompt_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    await supabaseAdmin
      .from("prompt_runs")
      .delete()
      .eq("user_id", userId);

    // 4. icp_chat_sessions
    await supabaseAdmin
      .from("icp_chat_sessions")
      .delete()
      .eq("user_id", userId);

    // 5. matches
    await supabaseAdmin
      .from("matches")
      .delete()
      .eq("user_id", userId);

    // 6. payments
    await supabaseAdmin
      .from("payments")
      .delete()
      .eq("user_id", userId);

    // 7. notifications
    await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("user_id", userId);

    // 8. public.users
    await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", userId);

    // 9. auth.users — removes from Supabase Auth so they can sign up again
    const { error: authDeleteError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      console.error("AUTH DELETE ERROR:", authDeleteError.message);
      // User data is already gone from public tables, so still return success
      // but note the auth issue
      return NextResponse.json({
        success: true,
        warning: `Public data deleted but auth.users deletion failed: ${authDeleteError.message}`,
        deleted: {
          connections: connectionsCount || 0,
          pipelineJobs: pipelineJobsCount || 0,
          promptRuns: promptRunsCount || 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      deleted: {
        connections: connectionsCount || 0,
        pipelineJobs: pipelineJobsCount || 0,
        promptRuns: promptRunsCount || 0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
