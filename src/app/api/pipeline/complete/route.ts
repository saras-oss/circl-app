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

    const { userId } = await request.json();

    if (userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update({ processing_status: "completed" })
      .eq("id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send completion email for instant mode
    if (process.env.RESEND_API_KEY) {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('email, full_name, company_name')
        .eq('id', userId)
        .single();

      const { count: hitsCount } = await supabaseAdmin
        .from('user_connections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('match_score', 7);

      const { count: scoredCount } = await supabaseAdmin
        .from('user_connections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('match_score', 'is', null);

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
              to: process.env.RESEND_ADMIN_EMAIL || 'saras@incommon.ai',
              subject: `[${userData.full_name || userData.email}] Hit list ready — ${hitsCount || 0} matches found`,
              html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px"><h2 style="color:#0A2540">Hit list ready!</h2><p style="color:#596780;font-size:15px">${userData.full_name || userData.email} (${userData.email}) — ${userData.company_name || 'N/A'}</p><div style="background:#F6F8FA;border-radius:12px;padding:20px;margin:24px 0"><p style="color:#0A2540;font-size:14px;margin:4px 0"><strong>${scoredCount || 0}</strong> connections scored</p><p style="color:#0A2540;font-size:14px;margin:4px 0"><strong style="color:#0ABF53">${hitsCount || 0}</strong> matches (score 7+)</p></div><p style="color:#96A0B5;font-size:13px;margin-top:32px">— Circl Admin</p></div>`,
            }),
          });
          console.log(`EMAIL: Instant completion email sent for ${userData.full_name}`);
        } catch (e: unknown) {
          console.error(`EMAIL: Instant completion email failed:`, e instanceof Error ? e.message : e);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
