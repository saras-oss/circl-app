export const maxDuration = 300;
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";

export async function GET() {
  // Call the cron worker directly, bypassing auth
  const cronUrl = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.NEXT_PUBLIC_APP_URL || 'https://circl-app-five.vercel.app'}/api/cron/pipeline-worker`;

  const response = await fetch(cronUrl, {
    headers: {
      'Authorization': `Bearer ${process.env.CRON_SECRET}`,
    },
  });

  const result = await response.json();
  return NextResponse.json({ cron_result: result, tested_at: new Date().toISOString() });
}
