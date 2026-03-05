import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const testEmail = "saras@incommon.ai";

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not set" });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:
          process.env.RESEND_FROM_EMAIL || "Circl <onboarding@resend.dev>",
        to: testEmail,
        subject: "Circl Test — Your hit list is ready — 47 matches found",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="color: #0A2540; margin-bottom: 8px;">Your hit list is ready!</h2>
            <p style="color: #596780; font-size: 15px; line-height: 1.6;">Hey Saras,</p>
            <p style="color: #596780; font-size: 15px; line-height: 1.6;">
              We analyzed <strong>2,147</strong> connections and found
              <strong style="color: #0ABF53;">47 strong matches</strong> for VideoCX.
            </p>
            <div style="background: #F6F8FA; border-radius: 12px; padding: 20px; margin: 24px 0;">
              <p style="color: #0A2540; font-size: 14px; margin: 4px 0;"><strong>1,423</strong> connections scored</p>
              <p style="color: #0A2540; font-size: 14px; margin: 4px 0;"><strong style="color: #0ABF53;">47</strong> matches (score 7+)</p>
              <p style="color: #0A2540; font-size: 14px; margin: 4px 0;"><strong>1,647</strong> profiles enriched</p>
            </div>
            <a href="https://circl-app-five.vercel.app/dashboard/hit-list"
               style="display: inline-block; background: #0A2540; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
              View your hit list
            </a>
            <p style="color: #96A0B5; font-size: 13px; margin-top: 32px;">— Team Circl</p>
          </div>
        `,
      }),
    });

    const result = await response.json();
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      resend_response: result,
      sent_to: testEmail,
      sent_from:
        process.env.RESEND_FROM_EMAIL || "Circl <onboarding@resend.dev>",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message });
  }
}
