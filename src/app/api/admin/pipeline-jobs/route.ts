import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ADMIN_EMAILS = ["saras@incommon.ai", "piyush@incommon.ai"];

async function checkAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized", status: 401, email: null };

  const { data: authUser } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("id", user.id)
    .single();

  if (!authUser || !ADMIN_EMAILS.includes(authUser.email)) {
    return { error: "Forbidden", status: 403, email: null };
  }

  return { error: null, status: 200, email: authUser.email };
}

export async function GET() {
  try {
    const auth = await checkAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data: jobs, error } = await supabaseAdmin
      .from("pipeline_jobs")
      .select("*, users(full_name, email, company_name)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ jobs: jobs || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await checkAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { job_id, action } = await request.json();

    if (!job_id || !action) {
      return NextResponse.json(
        { error: "job_id and action are required" },
        { status: 400 }
      );
    }

    const validActions = [
      "pause",
      "cancel",
      "restart",
      "retry_failed",
      "force_complete",
      "resume",
    ];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    if (action === "resume") {
      const { data: job } = await supabaseAdmin
        .from("pipeline_jobs")
        .select("*")
        .eq("id", job_id)
        .single();

      if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }

      // Determine which step to resume from based on progress
      let resumeStatus = "classifying";
      if (job.classified_count > 0 && job.enriched_persons_count === 0)
        resumeStatus = "enriching_persons";
      if (job.enriched_persons_count > 0 && job.enriched_companies_count === 0)
        resumeStatus = "enriching_companies";
      if (job.enriched_persons_count > 0 && job.scored_count === 0)
        resumeStatus = "scoring";

      const { error } = await supabaseAdmin
        .from("pipeline_jobs")
        .update({
          status: resumeStatus,
          admin_action: null,
          admin_note: `Resumed by ${auth.email}`,
          consecutive_failures: 0,
        })
        .eq("id", job_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, resumed_to: resumeStatus });
    }

    // For all other actions: set admin_action for the cron worker to pick up
    const { error } = await supabaseAdmin
      .from("pipeline_jobs")
      .update({
        admin_action: action,
        admin_action_by: auth.email,
        admin_action_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, action });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
