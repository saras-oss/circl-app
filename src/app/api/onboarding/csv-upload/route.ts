import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { chunkArray } from "@/lib/utils";

interface ConnectionRow {
  first_name: string;
  last_name: string;
  linkedin_url: string;
  email_address: string;
  company: string;
  position: string;
  connected_on: string | null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, connections } = (await request.json()) as {
      userId: string;
      connections: ConnectionRow[];
    };

    if (userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      !connections ||
      !Array.isArray(connections) ||
      connections.length === 0
    ) {
      return NextResponse.json(
        { error: "No connections provided" },
        { status: 400 }
      );
    }

    // Ensure public.users row exists before inserting connections
    const { data: userExists } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", userId)
      .single();

    if (!userExists) {
      await supabaseAdmin.from("users").upsert(
        { id: userId, email: user.email },
        { onConflict: "id", ignoreDuplicates: true }
      );
    }

    // Guard: reject upload if a pipeline is actively running for this user
    const { data: activeJob } = await supabaseAdmin
      .from("pipeline_jobs")
      .select("id, status")
      .eq("user_id", userId)
      .in("status", ["queued", "classifying", "enriching", "enriching_persons", "enriching_companies", "scoring"])
      .maybeSingle();

    if (activeJob) {
      return NextResponse.json(
        { error: "A pipeline is already running. Please wait for it to complete." },
        { status: 409 }
      );
    }

    // Clean slate: delete existing connections and stale pipeline jobs before re-upload
    await supabaseAdmin
      .from("user_connections")
      .delete()
      .eq("user_id", userId);

    await supabaseAdmin
      .from("pipeline_jobs")
      .delete()
      .eq("user_id", userId)
      .in("status", ["completed", "failed", "cancelled", "paused"]);

    // Split rows: those with linkedin_url → upsert, those without → insert
    const upsertRows: Record<string, unknown>[] = [];
    const insertRows: Record<string, unknown>[] = [];

    for (const c of connections) {
      const row = {
        user_id: userId,
        first_name: c.first_name || "",
        last_name: c.last_name || "",
        linkedin_url: c.linkedin_url || "",
        email_address: c.email_address || "",
        company: c.company || "",
        position: c.position || "",
        connected_on: c.connected_on || null,
        classification_status: "pending",
        enrichment_status: "pending",
      };

      if (c.linkedin_url && c.linkedin_url.includes("linkedin.com")) {
        upsertRows.push(row);
      } else {
        insertRows.push(row);
      }
    }

    let totalProcessed = 0;

    // Upsert rows with linkedin_url (dedup on user_id + linkedin_url)
    if (upsertRows.length > 0) {
      const batches = chunkArray(upsertRows, 500);
      for (const batch of batches) {
        const { data, error } = await supabaseAdmin
          .from("user_connections")
          .upsert(batch, { onConflict: "user_id,linkedin_url" })
          .select("id");

        if (error) {
          // If unique constraint doesn't exist yet, fall back to insert
          if (error.message.includes("unique") || error.message.includes("constraint")) {
            const { data: insertData, error: insertError } = await supabaseAdmin
              .from("user_connections")
              .insert(batch)
              .select("id");

            if (insertError) {
              const isFkError = insertError.message.includes("foreign key constraint");
              return NextResponse.json(
                {
                  error: isFkError
                    ? "Something went wrong with your account. Please try logging out and back in."
                    : insertError.message,
                },
                { status: isFkError ? 400 : 500 }
              );
            }
            totalProcessed += insertData?.length || 0;
          } else {
            const isFkError = error.message.includes("foreign key constraint");
            return NextResponse.json(
              {
                error: isFkError
                  ? "Something went wrong with your account. Please try logging out and back in."
                  : error.message,
              },
              { status: isFkError ? 400 : 500 }
            );
          }
        } else {
          totalProcessed += data?.length || 0;
        }
      }
    }

    // Insert rows without linkedin_url (no dedup possible)
    if (insertRows.length > 0) {
      const batches = chunkArray(insertRows, 500);
      for (const batch of batches) {
        const { data, error } = await supabaseAdmin
          .from("user_connections")
          .insert(batch)
          .select("id");

        if (error) {
          const isFkError = error.message.includes("foreign key constraint");
          return NextResponse.json(
            {
              error: isFkError
                ? "Something went wrong with your account. Please try logging out and back in."
                : error.message,
            },
            { status: isFkError ? 400 : 500 }
          );
        }
        totalProcessed += data?.length || 0;
      }
    }

    // Update total connections count
    const { count: totalConnections } = await supabaseAdmin
      .from("user_connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    await supabaseAdmin
      .from("users")
      .update({ total_connections: totalConnections || totalProcessed })
      .eq("id", userId);

    const connectionCount = totalConnections || totalProcessed;

    if (connectionCount >= 50) {
      // Create a background pipeline job
      const { data: job } = await supabaseAdmin
        .from('pipeline_jobs')
        .insert({
          user_id: userId,
          total_connections: connectionCount,
          status: 'queued',
          mode: 'background',
        })
        .select()
        .single();

      if (job) {
        console.log(`PIPELINE: Created background job ${job.id} for ${connectionCount} connections`);

        // Send start email
        if (job.tracking_token && process.env.RESEND_API_KEY) {
          const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://circl-app-five.vercel.app'}/track/${job.tracking_token}`;
          const { data: emailUser } = await supabaseAdmin
            .from('users')
            .select('email, full_name, company_name')
            .eq('id', userId)
            .single();

          if (emailUser?.email) {
            const firstName = emailUser.full_name?.split(' ')[0] || 'there';
            try {
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: process.env.RESEND_FROM_EMAIL || 'Circl <onboarding@resend.dev>',
                  to: [emailUser.email, process.env.RESEND_ADMIN_EMAIL || 'saras@incommon.ai'].filter(Boolean),
                  subject: `We're analyzing your ${connectionCount} connections`,
                  html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
                      <h2 style="color: #0A2540; margin-bottom: 8px;">We're on it, ${firstName}!</h2>
                      <p style="color: #596780; font-size: 15px; line-height: 1.6;">
                        Your <strong>${connectionCount}</strong> connections are now being analyzed. We're enriching profiles, classifying seniority, and scoring each one against your ideal customer profile.
                      </p>
                      <p style="color: #596780; font-size: 15px; line-height: 1.6;">
                        We'll email you as soon as your hit list is ready.
                      </p>
                      <div style="background: #F6F8FA; border-radius: 12px; padding: 20px; margin: 24px 0;">
                        <p style="color: #0A2540; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">While you wait, here's what you can ask Circl:</p>
                        <p style="color: #596780; font-size: 14px; margin: 6px 0;">"Who in my network works at Series B startups?"</p>
                        <p style="color: #596780; font-size: 14px; margin: 6px 0;">"Find warm intros to fintech companies"</p>
                        <p style="color: #596780; font-size: 14px; margin: 6px 0;">"Which connections should I reach out to first?"</p>
                      </div>
                      <p style="color: #596780; font-size: 14px; line-height: 1.6;">
                        Ask Circl is your AI-powered networking assistant — once your results are in, ask it anything about your connections.
                      </p>
                      <p style="color: #96A0B5; font-size: 13px; margin-top: 32px;">— Team Circl</p>
                    </div>
                  `,
                }),
              });
              console.log(`EMAIL: Start email sent to ${emailUser.email}`);
            } catch (emailErr: unknown) {
              console.error(`EMAIL: Start email failed:`, emailErr instanceof Error ? emailErr.message : emailErr);
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        count: connectionCount,
        mode: 'background',
        tracking_token: job?.tracking_token,
      });
    }

    // Under 50 — use existing instant mode (browser orchestrator)
    // Send start email for instant mode too
    if (process.env.RESEND_API_KEY) {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('email, full_name, company_name')
        .eq('id', userId)
        .single();

      if (userData?.email) {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: process.env.RESEND_FROM_EMAIL || 'Circl <hello@circl.incommon.co>',
              to: [userData.email, process.env.RESEND_ADMIN_EMAIL || 'saras@incommon.ai'].filter(Boolean),
              subject: `We're analyzing your ${connectionCount} connections`,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
                  <h2 style="color: #0A2540; margin-bottom: 8px;">We're on it, ${userData.full_name?.split(' ')[0] || 'there'}!</h2>
                  <p style="color: #596780; font-size: 15px; line-height: 1.6;">
                    Your <strong>${connectionCount}</strong> connections are now being analyzed. We're enriching profiles, classifying seniority, and scoring each one against your ideal customer profile.
                  </p>
                  <p style="color: #596780; font-size: 15px; line-height: 1.6;">
                    We'll email you as soon as your hit list is ready.
                  </p>
                  <div style="background: #F6F8FA; border-radius: 12px; padding: 20px; margin: 24px 0;">
                    <p style="color: #0A2540; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">While you wait, here's what you can ask Circl:</p>
                    <p style="color: #596780; font-size: 14px; margin: 6px 0;">"Who in my network works at Series B startups?"</p>
                    <p style="color: #596780; font-size: 14px; margin: 6px 0;">"Find warm intros to fintech companies"</p>
                    <p style="color: #596780; font-size: 14px; margin: 6px 0;">"Which connections should I reach out to first?"</p>
                  </div>
                  <p style="color: #596780; font-size: 14px; line-height: 1.6;">
                    Ask Circl is your AI-powered networking assistant — once your results are in, ask it anything about your connections.
                  </p>
                  <p style="color: #96A0B5; font-size: 13px; margin-top: 32px;">— Team Circl</p>
                </div>
              `,
            }),
          });
          console.log(`EMAIL: Instant start email sent for ${userData.full_name}`);
        } catch (e: unknown) {
          console.error(`EMAIL: Instant start email failed:`, e instanceof Error ? e.message : e);
        }
      }
    }

    return NextResponse.json({ success: true, count: totalProcessed, mode: 'instant' });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
