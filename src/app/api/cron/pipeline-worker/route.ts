export const maxDuration = 300; // 5 minutes with Fluid Compute
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://circl-app-five.vercel.app';

const CRON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'x-cron-secret': process.env.CRON_SECRET || '',
};

const CHUNK_SIZE = 500;
const MAX_LOOP_MS = 240_000; // 240s — leave 60s buffer from 300s limit
const COMPANY_PASSES = 3; // best-effort company enrichment passes

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

/** Shorthand for updating pipeline_jobs */
async function updateJob(supabase: any, jobId: string, update: Record<string, unknown>) {
  await supabase.from('pipeline_jobs').update(update).eq('id', jobId);
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
    .in('status', ['queued', 'classifying', 'enriching',
                   'enriching_persons', 'enriching_companies', 'scoring'])
    .eq('mode', 'background')
    .is('admin_action', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ status: 'idle', message: 'No active jobs' });
  }

  // 3b. Concurrent tick protection — if another tick is still running, skip
  const lastTick = job.last_tick_at ? new Date(job.last_tick_at).getTime() : 0;
  const now = Date.now();
  if (now - lastTick < 30_000) {
    console.log(`CRON: Job ${job.id} is being processed by another tick (last tick ${Math.round((now - lastTick) / 1000)}s ago). Skipping.`);
    return NextResponse.json({ status: 'skipped', reason: 'concurrent_tick' });
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
      case 'enriching':
      case 'enriching_persons':    // legacy compat
      case 'enriching_companies':  // legacy compat
        await processEnrichBatch(supabase, job);
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

  console.log(`CRON: Job ${job.id} started — ${connections.length} total, classifying ALL`);
}

// ---------------------------------------------------------------------------
// Step: Classify Batch (loops until done or 240s timeout)
// ---------------------------------------------------------------------------

async function processClassifyBatch(supabase: any, job: any) {
  const loopStart = Date.now();
  let totalProcessedThisTick = 0;

  while (Date.now() - loopStart < MAX_LOOP_MS) {
    // Check ALL unclassified (not just recent)
    const { count: pendingCount } = await supabase
      .from('user_connections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', job.user_id)
      .eq('classification_status', 'pending');

    if ((pendingCount || 0) === 0) {
      // Classification done for ALL connections
      // Mark ALL tier3/tier4 as skipped for enrichment
      await supabase
        .from('user_connections')
        .update({ enrichment_status: 'skipped' })
        .eq('user_id', job.user_id)
        .in('enrichment_tier', ['tier3', 'tier4']);

      const { count: skippedCount } = await supabase
        .from('user_connections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', job.user_id)
        .eq('enrichment_status', 'skipped');

      const { count: classifiedTotal } = await supabase
        .from('user_connections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', job.user_id)
        .not('classification_status', 'eq', 'pending');

      const { count: enrichEligible } = await supabase
        .from('user_connections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', job.user_id)
        .eq('enrichment_status', 'pending');

      await updateJob(supabase, job.id, {
        status: 'enriching',
        classified_count: classifiedTotal || 0,
        skipped_count: skippedCount || 0,
      });

      console.log(`CRON: Classification DONE. Classified: ${classifiedTotal}, Skipped: ${skippedCount}, Eligible for enrichment: ${enrichEligible}. Processed ${totalProcessedThisTick} this tick.`);
      return;
    }

    // Call classify endpoint
    const { data: result } = await callEndpoint('/api/pipeline/classify', {
      userId: job.user_id,
    });

    totalProcessedThisTick += result?.processed || 0;

    // COUNTER UPDATE INSIDE LOOP
    const { count: classifiedSoFar } = await supabase
      .from('user_connections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', job.user_id)
      .not('classification_status', 'eq', 'pending');

    await updateJob(supabase, job.id, {
      classified_count: classifiedSoFar || 0,
    });
  }

  console.log(`CRON: Classification tick timeout. Processed ${totalProcessedThisTick}. Continuing next tick.`);
}

// ---------------------------------------------------------------------------
// Step: Enrich Batch — persons + companies in one step (loops until done or 240s timeout)
// ---------------------------------------------------------------------------

async function processEnrichBatch(supabase: any, job: any) {
  const loopStart = Date.now();
  let totalProcessedThisTick = 0;

  // DB-based stuck detection: track whether enriched+failed count changes
  let lastProgressTotal = 0;
  let stuckCheckCount = 0;

  while (Date.now() - loopStart < MAX_LOOP_MS) {
    // Check pending enrichments (tier1/tier2 only — tier3/tier4 are 'skipped')
    const { count: pendingCount } = await supabase
      .from('user_connections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', job.user_id)
      .eq('enrichment_status', 'pending')
      .in('enrichment_tier', ['tier1', 'tier2']);

    if ((pendingCount || 0) === 0) {
      // All enrichment done — move to scoring
      const { count: enrichedCount } = await supabase
        .from('user_connections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', job.user_id)
        .in('enrichment_status', ['enriched', 'cached']);

      const { count: companyCount } = await supabase
        .from('enriched_companies')
        .select('id', { count: 'exact', head: true });

      await updateJob(supabase, job.id, {
        status: 'scoring',
        enriched_persons_count: enrichedCount || 0,
        enriched_companies_count: companyCount || 0,
      });

      console.log(`CRON: Enrichment DONE. Enriched: ${enrichedCount}, Companies: ${companyCount}. Processed ${totalProcessedThisTick} this tick. Moving to scoring.`);
      return;
    }

    // Call enrich endpoint
    const { data: result } = await callEndpoint('/api/pipeline/enrich', {
      userId: job.user_id,
    });

    totalProcessedThisTick += result?.processed || 0;

    // COUNTER UPDATE INSIDE LOOP
    const { count: enrichedSoFar } = await supabase
      .from('user_connections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', job.user_id)
      .in('enrichment_status', ['enriched', 'cached']);

    const { count: failedSoFar } = await supabase
      .from('user_connections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', job.user_id)
      .eq('enrichment_status', 'failed');

    await updateJob(supabase, job.id, {
      enriched_persons_count: enrichedSoFar || 0,
    });

    // DB-BASED STUCK DETECTION: has anything changed?
    const currentProgressTotal = (enrichedSoFar || 0) + (failedSoFar || 0);
    if (currentProgressTotal === lastProgressTotal) {
      stuckCheckCount++;
    } else {
      stuckCheckCount = 0;
      lastProgressTotal = currentProgressTotal;
    }

    // Genuinely stuck if NOTHING changed in DB for 20 consecutive calls
    if (stuckCheckCount >= 20) {
      console.error(`CRON: Enrichment genuinely stuck. ${pendingCount} pending, no DB changes for 20 calls. Marking remaining as failed.`);

      await supabase
        .from('user_connections')
        .update({ enrichment_status: 'failed', enrichment_error: 'Stuck after 20 attempts with no progress' })
        .eq('user_id', job.user_id)
        .eq('enrichment_status', 'pending')
        .in('enrichment_tier', ['tier1', 'tier2']);

      const { count: enrichedCount } = await supabase
        .from('user_connections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', job.user_id)
        .in('enrichment_status', ['enriched', 'cached']);

      const { count: companyCount } = await supabase
        .from('enriched_companies')
        .select('id', { count: 'exact', head: true });

      await updateJob(supabase, job.id, {
        status: 'scoring',
        enriched_persons_count: enrichedCount || 0,
        enriched_companies_count: companyCount || 0,
        failed_items_count: pendingCount || 0,
      });
      return;
    }

  }

  console.log(`CRON: Enrichment tick timeout. Processed ${totalProcessedThisTick}. Continuing next tick.`);
}

// ---------------------------------------------------------------------------
// Step: Score Batch (loops until done or 240s timeout)
// ---------------------------------------------------------------------------

async function processScoreBatch(supabase: any, job: any) {
  const loopStart = Date.now();
  let totalProcessedThisTick = 0;

  // DB-based stuck detection
  let lastScoredTotal = 0;
  let stuckCheckCount = 0;

  // Verify ICP exists before scoring
  const { data: userData } = await supabase
    .from('users')
    .select('icp_data, icp_confirmed')
    .eq('id', job.user_id)
    .single();

  const icpData = typeof userData?.icp_data === 'string' ? JSON.parse(userData.icp_data) : userData?.icp_data;

  if (!icpData?.industries || icpData.industries.length === 0) {
    await updateJob(supabase, job.id, {
      status: 'failed',
      admin_note: 'ICP is empty — user must confirm ICP before scoring',
    });
    console.error(`CRON: Job ${job.id} failed — ICP empty`);
    return;
  }

  while (Date.now() - loopStart < MAX_LOOP_MS) {
    // Check if any unscored enriched connections remain
    const { count: unscoredCount } = await supabase
      .from('user_connections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', job.user_id)
      .in('enrichment_status', ['enriched', 'cached'])
      .is('match_score', null);

    if ((unscoredCount || 0) === 0) {
      // ALL SCORING DONE
      const { count: hitsCount } = await supabase
        .from('user_connections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', job.user_id)
        .gte('match_score', 7);

      const { count: scoredTotal } = await supabase
        .from('user_connections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', job.user_id)
        .not('match_score', 'is', null);

      await updateJob(supabase, job.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        scored_count: scoredTotal || 0,
        hits_count: hitsCount || 0,
      });

      // Mark user as complete
      await supabase.from('users').update({
        processing_status: 'completed',
        onboarding_completed: true,
      }).eq('id', job.user_id);

      // Send completion email
      console.log(`CRON: Job ${job.id} COMPLETED. Hits: ${hitsCount}, Scored: ${scoredTotal}. Sending email.`);
      await sendCompletionEmail(supabase, job, hitsCount || 0, scoredTotal || 0);

      console.log(`CRON: Job ${job.id} done. Processed ${totalProcessedThisTick} this tick.`);
      return;
    }

    // Call score endpoint
    const { data: result } = await callEndpoint('/api/pipeline/score', {
      userId: job.user_id,
    });

    totalProcessedThisTick += result?.scored || 0;

    // COUNTER UPDATE INSIDE LOOP
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

    await updateJob(supabase, job.id, {
      scored_count: scoredCount || 0,
      hits_count: hitsCount || 0,
    });

    // DB-BASED STUCK DETECTION
    const currentScoredTotal = scoredCount || 0;
    if (currentScoredTotal === lastScoredTotal) {
      stuckCheckCount++;
    } else {
      stuckCheckCount = 0;
      lastScoredTotal = currentScoredTotal;
    }

    // Genuinely stuck if scored count hasn't changed for 20 consecutive calls
    if (stuckCheckCount >= 20) {
      console.error(`CRON: Scoring genuinely stuck. ${unscoredCount} unscored, no DB changes for 20 calls. Marking as -1.`);

      await supabase
        .from('user_connections')
        .update({ match_score: -1, scored_at: new Date().toISOString() })
        .eq('user_id', job.user_id)
        .in('enrichment_status', ['enriched', 'cached'])
        .is('match_score', null);

      stuckCheckCount = 0;
      lastScoredTotal = 0;
      continue; // Loop will re-check unscoredCount and find 0, then complete
    }
  }

  console.log(`CRON: Scoring tick timeout. Processed ${totalProcessedThisTick}. Continuing next tick.`);
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
        status: (needsEnrich || 0) > 0 ? 'enriching' : 'scoring',
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
  if (!process.env.RESEND_API_KEY) {
    console.log(`CRON: No RESEND_API_KEY — skipping completion email`);
    return;
  }

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
        to: [user.email, process.env.RESEND_ADMIN_EMAIL || 'saras@incommon.ai'].filter(Boolean),
        subject: `Your hit list is ready — ${hitsCount} matches found`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="color: #0A2540; margin-bottom: 8px;">Your hit list is ready!</h2>
            <p style="color: #596780; font-size: 15px; line-height: 1.6;">
              Hey ${firstName}, we've finished analyzing your network.
            </p>
            <div style="background: #F6F8FA; border-radius: 12px; padding: 20px; margin: 24px 0;">
              <p style="color: #0A2540; font-size: 16px; margin: 4px 0;"><strong>${job.total_connections}</strong> connections analyzed</p>
              <p style="color: #0A2540; font-size: 16px; margin: 4px 0;"><strong>${job.enriched_persons_count || 0}</strong> profiles enriched</p>
              <p style="color: #0ABF53; font-size: 16px; margin: 4px 0; font-weight: 600;">${hitsCount} strong matches for ${user.company_name || 'your business'}</p>
            </div>
            <a href="${dashboardUrl}/dashboard/hit-list"
               style="display: inline-block; background: #0A2540; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin-top: 8px;">
              View your hit list
            </a>
            <div style="background: #F6F8FA; border-radius: 12px; padding: 20px; margin: 24px 0;">
              <p style="color: #0A2540; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">Try asking Circl:</p>
              <p style="color: #596780; font-size: 14px; margin: 6px 0;">"Who are my strongest connections at enterprise companies?"</p>
              <p style="color: #596780; font-size: 14px; margin: 6px 0;">"Draft a re-engagement message for my top matches"</p>
              <p style="color: #596780; font-size: 14px; margin: 6px 0;">"Which of my hits have the shortest path to a deal?"</p>
            </div>
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

