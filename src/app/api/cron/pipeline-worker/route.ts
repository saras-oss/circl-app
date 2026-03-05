export const maxDuration = 300; // 5 minutes with Fluid Compute
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_APP_URL || 'https://circl-app-five.vercel.app';

const CRON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'x-cron-secret': process.env.CRON_SECRET || '',
};

const CHUNK_SIZE = 500;

/** Safely call a pipeline endpoint — handles HTML/non-JSON responses */
async function callEndpoint(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<{ data: any; ok: boolean }> {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: CRON_HEADERS,
      body: JSON.stringify(body),
    });

    const text = await response.text();

    try {
      const data = JSON.parse(text);
      if (!response.ok && data.error) {
        throw new Error(`${endpoint} returned ${response.status}: ${data.error}`);
      }
      return { data, ok: response.ok };
    } catch (parseErr) {
      // Got HTML back — likely deployment protection
      console.warn(`CRON: ${endpoint} returned non-JSON (status ${response.status}). Body: ${text.slice(0, 200)}`);
      throw new Error(`${endpoint} returned non-JSON response (status ${response.status})`);
    }
  } catch (err: any) {
    if (err.message?.includes('returned non-JSON') || err.message?.includes('returned')) {
      throw err;
    }
    throw new Error(`${endpoint} fetch failed: ${err.message}`);
  }
}

/** Chunk large ID arrays for .in() calls (Supabase URL length limit) */
async function chunkedUpdate(
  supabase: any,
  table: string,
  ids: string[],
  update: Record<string, unknown>,
) {
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    await supabase.from(table).update(update).in('id', chunk);
  }
}

// ---------------------------------------------------------------------------
// Main GET handler — cron entry point
// ---------------------------------------------------------------------------

export async function GET() {
  // No auth check needed — this endpoint is called by Vercel cron only
  // The vercel.json cron config ensures only Vercel calls this
  console.log("CRON: Tick started at", new Date().toISOString());

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 2. Always handle pending admin actions first (even on paused jobs)
  await handleAdminActions(supabase);

  // 3. Find the oldest active background job
  const { data: job, error: jobError } = await supabase
    .from('pipeline_jobs')
    .select('*')
    .in('status', ['queued', 'classifying', 'enriching_persons',
                   'enriching_companies', 'scoring'])
    .eq('mode', 'background')
    .is('admin_action', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ status: 'idle', message: 'No active jobs' });
  }

  // 4. Auto-pause on repeated failures
  if (job.consecutive_failures >= 5) {
    await supabase.from('pipeline_jobs').update({
      status: 'paused',
      admin_note: 'Auto-paused: 5 consecutive failures. Check error_log.',
    }).eq('id', job.id);

    console.log(`CRON: Auto-paused job ${job.id} after 5 consecutive failures`);
    return NextResponse.json({ status: 'auto_paused', job_id: job.id });
  }

  // 5. Update last_tick
  await supabase.from('pipeline_jobs').update({
    last_tick_at: new Date().toISOString(),
  }).eq('id', job.id);

  // 6. Process based on current status
  console.log(`CRON: Processing job ${job.id} — status: ${job.status}, user: ${job.user_id}`);

  try {
    switch (job.status) {
      case 'queued':
        await startJob(supabase, job);
        break;
      case 'classifying':
        await processClassifyBatch(supabase, job);
        break;
      case 'enriching_persons':
        await processEnrichPersonBatch(supabase, job);
        break;
      case 'enriching_companies':
        await processEnrichCompanyBatch(supabase, job);
        break;
      case 'scoring':
        await processScoreBatch(supabase, job);
        break;
    }

    // Reset consecutive failures on success
    if (job.consecutive_failures > 0) {
      await supabase.from('pipeline_jobs').update({
        consecutive_failures: 0,
      }).eq('id', job.id);
    }

  } catch (err: any) {
    console.error(`CRON: Error processing job ${job.id}:`, err.message);

    await supabase.from('pipeline_jobs').update({
      consecutive_failures: (job.consecutive_failures || 0) + 1,
      error_log: [...(job.error_log || []), {
        step: job.status,
        error: err.message,
        timestamp: new Date().toISOString(),
      }],
    }).eq('id', job.id);
  }

  // 7. Calculate and update ETA (re-read job for latest counts)
  const { data: updatedJob } = await supabase
    .from('pipeline_jobs')
    .select('*')
    .eq('id', job.id)
    .single();

  if (updatedJob) {
    await updateETA(supabase, updatedJob);
  }

  return NextResponse.json({
    status: 'processed',
    job_id: job.id,
    step: job.status,
  });
}

// ---------------------------------------------------------------------------
// Step: Start Job — split connections into old/recent halves
// ---------------------------------------------------------------------------

async function startJob(supabase: any, job: any) {
  const { data: connections } = await supabase
    .from('user_connections')
    .select('id, connected_on')
    .eq('user_id', job.user_id)
    .order('connected_on', { ascending: true });

  if (!connections || connections.length === 0) {
    await supabase.from('pipeline_jobs').update({
      status: 'failed',
      admin_note: 'No connections found for this user',
    }).eq('id', job.id);
    return;
  }

  // Find median date to split old vs recent
  const midIndex = Math.floor(connections.length / 2);
  const medianDate = connections[midIndex].connected_on;

  const oldIds = connections
    .filter((c: any) => c.connected_on < medianDate)
    .map((c: any) => c.id);
  const recentIds = connections
    .filter((c: any) => c.connected_on >= medianDate)
    .map((c: any) => c.id);

  // Chunked batch updates for large connection sets
  if (oldIds.length > 0) {
    await chunkedUpdate(supabase, 'user_connections', oldIds, { recent_half: false });
  }
  if (recentIds.length > 0) {
    await chunkedUpdate(supabase, 'user_connections', recentIds, { recent_half: true });
  }

  await supabase.from('pipeline_jobs').update({
    status: 'classifying',
    started_at: new Date().toISOString(),
    recent_cutoff_date: medianDate,
    recent_count: recentIds.length,
    old_count: oldIds.length,
    total_connections: connections.length,
  }).eq('id', job.id);

  console.log(`CRON: Job ${job.id} started — ${oldIds.length} old, ${recentIds.length} recent, cutoff: ${medianDate}`);
}

// ---------------------------------------------------------------------------
// Step: Classify Batch
// ---------------------------------------------------------------------------

async function processClassifyBatch(supabase: any, job: any) {
  // Call existing classify endpoint with cron auth
  const { data: result } = await callEndpoint('/api/pipeline/classify', {
    userId: job.user_id,
  });

  console.log(`CRON: Classify result:`, result);

  // Check if classification is complete
  const { count: pendingRecent } = await supabase
    .from('user_connections')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', job.user_id)
    .eq('recent_half', true)
    .eq('classification_status', 'pending');

  const { count: classifiedCount } = await supabase
    .from('user_connections')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', job.user_id)
    .not('classification_status', 'eq', 'pending');

  await supabase.from('pipeline_jobs').update({
    classified_count: classifiedCount || 0,
  }).eq('id', job.id);

  if (pendingRecent === 0) {
    // Mark recent tier3/tier4 as skipped for enrichment
    await supabase
      .from('user_connections')
      .update({ enrichment_status: 'skipped' })
      .eq('user_id', job.user_id)
      .eq('recent_half', true)
      .in('enrichment_tier', ['tier3', 'tier4']);

    const { count: skippedCount } = await supabase
      .from('user_connections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', job.user_id)
      .eq('enrichment_status', 'skipped');

    await supabase.from('pipeline_jobs').update({
      status: 'enriching_persons',
      skipped_count: skippedCount || 0,
    }).eq('id', job.id);

    console.log(`CRON: Classification complete. Moving to enrichment. Skipped: ${skippedCount}`);
  }
}

// ---------------------------------------------------------------------------
// Step: Enrich Person Batch
// ---------------------------------------------------------------------------

async function processEnrichPersonBatch(supabase: any, job: any) {
  const { data: result } = await callEndpoint('/api/pipeline/enrich', {
    userId: job.user_id,
  });

  console.log(`CRON: Enrich result:`, result);

  // Count enriched
  const { count: enrichedCount } = await supabase
    .from('user_connections')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', job.user_id)
    .in('enrichment_status', ['enriched', 'cached']);

  await supabase.from('pipeline_jobs').update({
    enriched_persons_count: enrichedCount || 0,
  }).eq('id', job.id);

  // Check if all eligible connections are enriched
  const { count: pendingEnrich } = await supabase
    .from('user_connections')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', job.user_id)
    .eq('enrichment_status', 'pending');

  if (pendingEnrich === 0) {
    await supabase.from('pipeline_jobs').update({
      status: 'enriching_companies',
    }).eq('id', job.id);

    console.log(`CRON: Person enrichment complete. Moving to company enrichment.`);
  }

  // Send 50% progress email at enrichment midpoint
  const totalToEnrich = enrichedCount || 0;
  const totalConnections = job.total_connections || 1;
  if (!job.email_sent_progress && totalToEnrich > totalConnections / 3) {
    await sendProgressEmail(supabase, job);
    await supabase.from('pipeline_jobs').update({
      email_sent_progress: true,
    }).eq('id', job.id);
  }
}

// ---------------------------------------------------------------------------
// Step: Enrich Company Batch (company enrichment happens inline during person
// enrichment — this step is a safety pass + transition to scoring)
// ---------------------------------------------------------------------------

async function processEnrichCompanyBatch(supabase: any, job: any) {
  // Call enrich once more — if all persons done, this is a no-op but may
  // catch any remaining company enrichments from the cached path
  try {
    const { data: result } = await callEndpoint('/api/pipeline/enrich', {
      userId: job.user_id,
    });
    console.log(`CRON: Company enrich pass:`, result);
  } catch (err: any) {
    // Non-fatal — company enrichment is best-effort
    console.error(`CRON: Company enrichment error (non-fatal):`, err.message);
  }

  // Count enriched companies (global count)
  const { count: companyCount } = await supabase
    .from('enriched_companies')
    .select('id', { count: 'exact', head: true });

  // Move to scoring regardless
  await supabase.from('pipeline_jobs').update({
    enriched_companies_count: companyCount || 0,
    status: 'scoring',
  }).eq('id', job.id);

  console.log(`CRON: Company enrichment done. Moving to scoring. Companies: ${companyCount}`);
}

// ---------------------------------------------------------------------------
// Step: Score Batch
// ---------------------------------------------------------------------------

async function processScoreBatch(supabase: any, job: any) {
  const { data: result } = await callEndpoint('/api/pipeline/score', {
    userId: job.user_id,
  });

  console.log(`CRON: Score result:`, result);

  // Count scored + hits (always from DB, not from result)
  const { count: scoredCount } = await supabase
    .from('user_connections')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', job.user_id)
    .not('match_score', 'is', null);

  const { count: hitsCount } = await supabase
    .from('user_connections')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', job.user_id)
    .gte('match_score', 7);

  await supabase.from('pipeline_jobs').update({
    scored_count: scoredCount || 0,
    hits_count: hitsCount || 0,
  }).eq('id', job.id);

  // Check if scoring is complete
  const hasMore = result?.hasMore !== false && (result?.remaining || 0) > 0;

  if (!hasMore) {
    await supabase.from('pipeline_jobs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      scored_count: scoredCount || 0,
      hits_count: hitsCount || 0,
    }).eq('id', job.id);

    // Update user status
    await supabase.from('users').update({
      processing_status: 'completed',
      onboarding_completed: true,
    }).eq('id', job.user_id);

    // Send completion email
    await sendCompletionEmail(supabase, job, hitsCount || 0, scoredCount || 0);

    console.log(`CRON: Job ${job.id} COMPLETED. Scored: ${scoredCount}, Hits: ${hitsCount}`);
    return;
  }

  // Send 50% scoring progress email
  const totalToScore = job.enriched_persons_count || 1;
  if (!job.email_sent_progress && (scoredCount || 0) > totalToScore / 2) {
    await sendProgressEmail(supabase, job);
    await supabase.from('pipeline_jobs').update({
      email_sent_progress: true,
    }).eq('id', job.id);
  }
}

// ---------------------------------------------------------------------------
// Admin Action Handler
// ---------------------------------------------------------------------------

async function handleAdminActions(supabase: any) {
  const { data: jobs } = await supabase
    .from('pipeline_jobs')
    .select('*')
    .not('admin_action', 'is', null)
    .limit(10);

  if (!jobs || jobs.length === 0) return;

  for (const job of jobs) {
    await processAdminAction(supabase, job);
  }
}

async function processAdminAction(supabase: any, job: any) {
  console.log(`CRON: Processing admin action '${job.admin_action}' for job ${job.id}`);

  switch (job.admin_action) {
    case 'pause':
      await supabase.from('pipeline_jobs').update({
        status: 'paused',
        admin_action: null,
        admin_action_at: new Date().toISOString(),
      }).eq('id', job.id);
      console.log(`CRON: Job ${job.id} PAUSED by ${job.admin_action_by}`);
      break;

    case 'cancel':
      await supabase.from('pipeline_jobs').update({
        status: 'cancelled',
        admin_action: null,
        admin_action_at: new Date().toISOString(),
      }).eq('id', job.id);
      console.log(`CRON: Job ${job.id} CANCELLED by ${job.admin_action_by}`);
      break;

    case 'restart': {
      // Reset all connection statuses for this user
      await supabase.from('user_connections').update({
        match_score: null, scored_at: null, match_type: null,
        match_reasons: null, suggested_approach: null,
        enrichment_status: 'pending', classification_status: 'pending',
        recent_half: null, seniority_tier: null, enrichment_tier: null,
        function_category: null, decision_maker_likelihood: null,
        connection_type_signal: null,
      }).eq('user_id', job.user_id);

      await supabase.from('pipeline_jobs').update({
        status: 'queued',
        admin_action: null,
        classified_count: 0, enriched_persons_count: 0,
        enriched_companies_count: 0, scored_count: 0,
        hits_count: 0, skipped_count: 0, failed_items_count: 0,
        consecutive_failures: 0, error_log: [],
        started_at: null, completed_at: null,
        email_sent_progress: false, email_sent_complete: false,
      }).eq('id', job.id);
      console.log(`CRON: Job ${job.id} RESTARTED by ${job.admin_action_by}`);
      break;
    }

    case 'retry_failed': {
      // Reset only failed enrichments
      await supabase.from('user_connections').update({
        enrichment_status: 'pending', enrichment_error: null,
      }).eq('user_id', job.user_id).eq('enrichment_status', 'failed');

      // Reset failed scores (score = -1)
      await supabase.from('user_connections').update({
        match_score: null, scored_at: null,
      }).eq('user_id', job.user_id).eq('match_score', -1);

      // Determine which step to resume from
      const { count: needsEnrich } = await supabase
        .from('user_connections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', job.user_id)
        .eq('enrichment_status', 'pending');

      await supabase.from('pipeline_jobs').update({
        status: (needsEnrich || 0) > 0 ? 'enriching_persons' : 'scoring',
        admin_action: null,
        consecutive_failures: 0,
      }).eq('id', job.id);
      console.log(`CRON: Job ${job.id} RETRY_FAILED by ${job.admin_action_by}`);
      break;
    }

    case 'force_complete': {
      const { count: hits } = await supabase
        .from('user_connections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', job.user_id)
        .gte('match_score', 7);

      const { count: scored } = await supabase
        .from('user_connections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', job.user_id)
        .not('match_score', 'is', null);

      await supabase.from('pipeline_jobs').update({
        status: 'completed',
        admin_action: null,
        completed_at: new Date().toISOString(),
        hits_count: hits || 0,
        scored_count: scored || 0,
        admin_note: `Force completed by ${job.admin_action_by}`,
      }).eq('id', job.id);

      await supabase.from('users').update({
        processing_status: 'completed',
        onboarding_completed: true,
      }).eq('id', job.user_id);

      // Send completion email
      await sendCompletionEmail(supabase, job, hits || 0, scored || 0);

      console.log(`CRON: Job ${job.id} FORCE_COMPLETED by ${job.admin_action_by}`);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// ETA Calculator
// ---------------------------------------------------------------------------

async function updateETA(supabase: any, job: any) {
  if (!job.started_at) return;
  // Don't update ETA for completed/failed/paused jobs
  if (['completed', 'failed', 'paused', 'cancelled'].includes(job.status)) return;

  const elapsed = Date.now() - new Date(job.started_at).getTime();
  const totalItems = job.total_connections || 1;

  // Weight each stage: classify = 1x, enrich = 3x (slowest), score = 2x
  const classifyWeight = 1;
  const enrichWeight = 3;
  const scoreWeight = 2;
  const totalWeight = totalItems * (classifyWeight + enrichWeight + scoreWeight);

  const processedWeight =
    (job.classified_count || 0) * classifyWeight +
    (job.enriched_persons_count || 0) * enrichWeight +
    (job.scored_count || 0) * scoreWeight;

  if (processedWeight === 0) return;

  const msPerWeightUnit = elapsed / processedWeight;
  const remainingWeight = totalWeight - processedWeight;
  const estimatedMs = remainingWeight * msPerWeightUnit;

  const eta = new Date(Date.now() + estimatedMs);

  await supabase.from('pipeline_jobs').update({
    estimated_completion: eta.toISOString(),
  }).eq('id', job.id);
}

// ---------------------------------------------------------------------------
// Email Functions
// ---------------------------------------------------------------------------

async function sendCompletionEmail(supabase: any, job: any, hitsCount: number, scoredCount: number) {
  if (!process.env.RESEND_API_KEY) return;

  const { data: user } = await supabase
    .from('users')
    .select('email, full_name, company_name')
    .eq('id', job.user_id)
    .single();

  if (!user?.email) return;

  const firstName = user.full_name?.split(' ')[0] || 'there';
  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://circl-app-five.vercel.app';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Circl <onboarding@resend.dev>',
        to: user.email,
        subject: `Your hit list is ready — ${hitsCount} matches found`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="color: #0A2540; margin-bottom: 8px;">Your hit list is ready!</h2>
            <p style="color: #596780; font-size: 15px; line-height: 1.6;">
              Hey ${firstName},
            </p>
            <p style="color: #596780; font-size: 15px; line-height: 1.6;">
              We analyzed <strong>${job.total_connections}</strong> connections and found
              <strong style="color: #0ABF53;">${hitsCount} strong matches</strong> for ${user.company_name || 'your business'}.
            </p>
            <div style="background: #F6F8FA; border-radius: 12px; padding: 20px; margin: 24px 0;">
              <p style="color: #0A2540; font-size: 14px; margin: 4px 0;"><strong>${scoredCount}</strong> connections scored</p>
              <p style="color: #0A2540; font-size: 14px; margin: 4px 0;"><strong style="color: #0ABF53;">${hitsCount}</strong> matches (score 7+)</p>
              <p style="color: #0A2540; font-size: 14px; margin: 4px 0;"><strong>${job.enriched_persons_count || 0}</strong> profiles enriched</p>
            </div>
            <a href="${dashboardUrl}/dashboard/hit-list"
               style="display: inline-block; background: #0A2540; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin-top: 8px;">
              View your hit list
            </a>
            <p style="color: #96A0B5; font-size: 13px; margin-top: 32px;">— Team Circl</p>
          </div>
        `,
      }),
    });

    if (response.ok) {
      await supabase.from('pipeline_jobs').update({ email_sent_complete: true }).eq('id', job.id);
      console.log(`CRON: Completion email sent to ${user.email}`);
    } else {
      console.error(`CRON: Email send failed:`, await response.text());
    }
  } catch (err: any) {
    console.error(`CRON: Email error:`, err.message);
  }
}

async function sendProgressEmail(supabase: any, job: any) {
  if (!process.env.RESEND_API_KEY) return;

  const { data: user } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('id', job.user_id)
    .single();

  if (!user?.email) return;

  const firstName = user.full_name?.split(' ')[0] || 'there';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://circl-app-five.vercel.app';
  const trackUrl = job.tracking_token
    ? `${baseUrl}/track/${job.tracking_token}`
    : `${baseUrl}/dashboard`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Circl <onboarding@resend.dev>',
        to: user.email,
        subject: `Halfway there — ${job.enriched_persons_count || 0} profiles enriched`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="color: #0A2540;">Quick update</h2>
            <p style="color: #596780; font-size: 15px; line-height: 1.6;">
              Hey ${firstName}, we've enriched <strong>${job.enriched_persons_count || 0}</strong> profiles
              and found <strong style="color: #0ABF53;">${job.hits_count || 0} matches</strong> so far.
            </p>
            <p style="color: #596780; font-size: 15px;">We'll send your full results soon.</p>
            <a href="${trackUrl}"
               style="display: inline-block; background: #F6F8FA; color: #0A2540; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px; border: 1px solid #E3E8EF; margin-top: 12px;">
              Track progress
            </a>
            <p style="color: #96A0B5; font-size: 13px; margin-top: 32px;">— Team Circl</p>
          </div>
        `,
      }),
    });

    console.log(`CRON: Progress email sent to ${user.email}`);
  } catch (err: any) {
    console.error(`CRON: Progress email error:`, err.message);
  }
}
