export const maxDuration = 300; // 5 minutes with Fluid Compute
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  // 1. Verify this is a legitimate cron call (Vercel sends CRON_SECRET)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 2. Find the oldest active background job
  const { data: job, error: jobError } = await supabase
    .from('pipeline_jobs')
    .select('*')
    .in('status', ['queued', 'classifying', 'enriching_persons',
                   'enriching_companies', 'scoring'])
    .eq('mode', 'background')
    .is('admin_action', null)  // skip jobs with pending admin actions
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (jobError || !job) {
    // Check for admin actions on paused/active jobs
    await handleAdminActions(supabase);
    return NextResponse.json({ status: 'idle', message: 'No active jobs' });
  }

  // 3. Handle admin actions first
  if (job.admin_action) {
    await processAdminAction(supabase, job);
    return NextResponse.json({ status: 'admin_action', action: job.admin_action });
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
        at: new Date().toISOString(),
      }],
    }).eq('id', job.id);
  }

  // 7. Calculate and update ETA
  await updateETA(supabase, job);

  return NextResponse.json({
    status: 'processed',
    job_id: job.id,
    step: job.status
  });
}

// --- Step Functions ---

const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_APP_URL || 'https://circl-app-five.vercel.app';

async function startJob(supabase: any, job: any) {
  // Split connections by connected_on date
  const { data: connections } = await supabase
    .from('user_connections')
    .select('id, connected_on')
    .eq('user_id', job.user_id)
    .order('connected_on', { ascending: true });

  if (!connections || connections.length === 0) {
    await supabase.from('pipeline_jobs').update({ status: 'failed', admin_note: 'No connections found' }).eq('id', job.id);
    return;
  }

  // Find median date
  const midIndex = Math.floor(connections.length / 2);
  const medianDate = connections[midIndex].connected_on;

  // Tag old vs recent
  const oldIds = connections.filter((c: any) => c.connected_on < medianDate).map((c: any) => c.id);
  const recentIds = connections.filter((c: any) => c.connected_on >= medianDate).map((c: any) => c.id);

  // Batch update — old half
  if (oldIds.length > 0) {
    await supabase
      .from('user_connections')
      .update({ recent_half: false })
      .in('id', oldIds);
  }

  // Batch update — recent half
  if (recentIds.length > 0) {
    await supabase
      .from('user_connections')
      .update({ recent_half: true })
      .in('id', recentIds);
  }

  // Update job
  await supabase.from('pipeline_jobs').update({
    status: 'classifying',
    started_at: new Date().toISOString(),
    recent_cutoff_date: medianDate,
    recent_count: recentIds.length,
    old_count: oldIds.length,
  }).eq('id', job.id);

  console.log(`CRON: Job ${job.id} started — ${oldIds.length} old, ${recentIds.length} recent, cutoff: ${medianDate}`);
}

async function processClassifyBatch(supabase: any, job: any) {
  // Only classify recent half
  // Call existing classify endpoint
  const response = await fetch(`${BASE_URL}/api/pipeline/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: job.user_id }),
  });

  const result = await response.json();
  console.log(`CRON: Classify result:`, result);

  // Check if classification is complete for recent half
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
    .eq('recent_half', true)
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

    // Count skipped
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

async function processEnrichPersonBatch(supabase: any, job: any) {
  // Call existing enrich endpoint
  const response = await fetch(`${BASE_URL}/api/pipeline/enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: job.user_id }),
  });

  const result = await response.json();
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
}

async function processEnrichCompanyBatch(supabase: any, job: any) {
  // Find unique company URLs that need enrichment
  const { data: profiles } = await supabase
    .from('enriched_profiles')
    .select('current_company_linkedin')
    .in('linkedin_url',
      supabase
        .from('user_connections')
        .select('linkedin_url')
        .eq('user_id', job.user_id)
        .in('enrichment_status', ['enriched', 'cached'])
    );

  // This is complex — instead, call the enrich endpoint again
  // The existing enrich endpoint already handles company enrichment
  // If all persons are enriched, the enrich endpoint will process companies

  // Simple approach: just call enrich again — it handles companies too
  const response = await fetch(`${BASE_URL}/api/pipeline/enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: job.user_id }),
  });

  const result = await response.json();
  console.log(`CRON: Company enrich result:`, result);

  // Count enriched companies
  const { count: companyCount } = await supabase
    .from('enriched_companies')
    .select('id', { count: 'exact', head: true });

  await supabase.from('pipeline_jobs').update({
    enriched_companies_count: companyCount || 0,
    status: 'scoring',  // Move to scoring — company enrichment is best-effort
  }).eq('id', job.id);

  console.log(`CRON: Company enrichment done. Moving to scoring.`);
}

async function processScoreBatch(supabase: any, job: any) {
  // Call existing score endpoint
  const response = await fetch(`${BASE_URL}/api/pipeline/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: job.user_id }),
  });

  const result = await response.json();
  console.log(`CRON: Score result:`, result);

  // Count scored + hits
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
  if (!result.hasMore) {
    await supabase.from('pipeline_jobs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      hits_count: hitsCount || 0,
    }).eq('id', job.id);

    // Update user processing_status
    await supabase.from('users').update({
      processing_status: 'completed',
    }).eq('id', job.user_id);

    // Send completion email
    await sendCompletionEmail(supabase, job);

    console.log(`CRON: Job ${job.id} COMPLETED. ${hitsCount} hits found.`);
  }

  // Send 50% progress email
  const totalToScore = job.enriched_persons_count || 1;
  if (!job.email_sent_progress && (scoredCount || 0) > totalToScore / 2) {
    await sendProgressEmail(supabase, job);
    await supabase.from('pipeline_jobs').update({
      email_sent_progress: true,
    }).eq('id', job.id);
  }
}

// --- Admin Action Handler ---

async function handleAdminActions(supabase: any) {
  // Find jobs with pending admin actions
  const { data: jobs } = await supabase
    .from('pipeline_jobs')
    .select('*')
    .not('admin_action', 'is', null)
    .limit(5);

  if (!jobs) return;

  for (const job of jobs) {
    await processAdminAction(supabase, job);
  }
}

async function processAdminAction(supabase: any, job: any) {
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

    case 'restart':
      // Reset all connection scores and statuses
      await supabase.from('user_connections').update({
        match_score: null, scored_at: null, match_type: null,
        match_reasons: null, suggested_approach: null,
        enrichment_status: 'pending', classification_status: 'pending',
        recent_half: null,
      }).eq('user_id', job.user_id);

      await supabase.from('pipeline_jobs').update({
        status: 'queued',
        admin_action: null,
        classified_count: 0, enriched_persons_count: 0,
        enriched_companies_count: 0, scored_count: 0,
        hits_count: 0, skipped_count: 0, failed_items_count: 0,
        consecutive_failures: 0, error_log: '[]',
        started_at: null, completed_at: null,
      }).eq('id', job.id);
      console.log(`CRON: Job ${job.id} RESTARTED by ${job.admin_action_by}`);
      break;

    case 'retry_failed':
      // Reset only failed items
      await supabase.from('user_connections').update({
        enrichment_status: 'pending', enrichment_error: null,
      }).eq('user_id', job.user_id).eq('enrichment_status', 'failed');

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

    case 'force_complete':
      const { count: hits } = await supabase
        .from('user_connections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', job.user_id)
        .gte('match_score', 7);

      await supabase.from('pipeline_jobs').update({
        status: 'completed',
        admin_action: null,
        completed_at: new Date().toISOString(),
        hits_count: hits || 0,
        admin_note: `Force completed by ${job.admin_action_by}`,
      }).eq('id', job.id);

      await supabase.from('users').update({
        processing_status: 'completed',
      }).eq('id', job.user_id);

      console.log(`CRON: Job ${job.id} FORCE_COMPLETED by ${job.admin_action_by}`);
      break;
  }
}

// --- ETA Calculator ---

async function updateETA(supabase: any, job: any) {
  if (!job.started_at) return;

  const elapsed = Date.now() - new Date(job.started_at).getTime();
  const totalItems = job.total_connections || 1;
  const processedItems = (job.classified_count || 0) + (job.enriched_persons_count || 0) + (job.scored_count || 0);
  const totalSteps = totalItems * 3; // classify + enrich + score

  if (processedItems === 0) return;

  const msPerItem = elapsed / processedItems;
  const remainingItems = totalSteps - processedItems;
  const estimatedMs = remainingItems * msPerItem;

  const eta = new Date(Date.now() + estimatedMs);

  await supabase.from('pipeline_jobs').update({
    estimated_completion: eta.toISOString(),
  }).eq('id', job.id);
}

// --- Email Functions ---

async function sendCompletionEmail(supabase: any, job: any) {
  // Get user info
  const { data: user } = await supabase
    .from('users')
    .select('email, full_name, company_name')
    .eq('id', job.user_id)
    .single();

  if (!user?.email) return;

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
        subject: `Your hit list is ready — ${job.hits_count} matches found`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="color: #0A2540; margin-bottom: 8px;">Your hit list is ready!</h2>
            <p style="color: #596780; font-size: 15px; line-height: 1.6;">
              Hey ${user.full_name?.split(' ')[0] || 'there'},
            </p>
            <p style="color: #596780; font-size: 15px; line-height: 1.6;">
              We analyzed <strong>${job.total_connections}</strong> connections and found
              <strong style="color: #0ABF53;">${job.hits_count} strong matches</strong> for ${user.company_name || 'your business'}.
            </p>
            <div style="background: #F6F8FA; border-radius: 12px; padding: 20px; margin: 24px 0;">
              <p style="color: #0A2540; font-size: 14px; margin: 4px 0;"><strong>${job.scored_count}</strong> connections scored</p>
              <p style="color: #0A2540; font-size: 14px; margin: 4px 0;"><strong style="color: #0ABF53;">${job.hits_count}</strong> matches (score 7+)</p>
              <p style="color: #0A2540; font-size: 14px; margin: 4px 0;"><strong>${job.enriched_persons_count}</strong> profiles enriched</p>
            </div>
            <a href="https://circl-app-five.vercel.app/dashboard/hit-list"
               style="display: inline-block; background: linear-gradient(135deg, #0ABF53, #34D399); color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin-top: 8px;">
              View your hit list
            </a>
            <p style="color: #96A0B5; font-size: 13px; margin-top: 32px;">
              — Team Circl
            </p>
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
  const { data: user } = await supabase
    .from('users')
    .select('email, full_name, company_name')
    .eq('id', job.user_id)
    .single();

  if (!user?.email) return;

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
        subject: `Halfway there — ${job.scored_count} connections scored`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="color: #0A2540;">Halfway there!</h2>
            <p style="color: #596780; font-size: 15px; line-height: 1.6;">
              Hey ${user.full_name?.split(' ')[0] || 'there'}, quick update: we've scored
              <strong>${job.scored_count}</strong> of your connections so far.
            </p>
            <p style="color: #596780; font-size: 15px; line-height: 1.6;">
              <strong style="color: #0ABF53;">${job.hits_count} strong matches</strong> found so far.
              We'll send your full results soon.
            </p>
            <a href="https://circl-app-five.vercel.app/track/${job.tracking_token}"
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
