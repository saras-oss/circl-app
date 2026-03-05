// Don't fetch the cron URL — just run the same database logic inline
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check for active jobs (same logic as cron worker)
  const { data: job, error } = await supabase
    .from('pipeline_jobs')
    .select('*')
    .in('status', ['queued', 'classifying', 'enriching_persons', 'enriching_companies', 'scoring'])
    .eq('mode', 'background')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({
      status: 'idle',
      message: 'No active background jobs',
      pipeline_jobs_error: error?.message || null,
      tested_at: new Date().toISOString()
    });
  }

  return NextResponse.json({
    status: 'found_job',
    job_id: job.id,
    job_status: job.status,
    user_id: job.user_id,
    total_connections: job.total_connections,
    tested_at: new Date().toISOString()
  });
}
