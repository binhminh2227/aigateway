import { NextRequest, NextResponse } from "next/server";

// Called by external cron (e.g. cron-job.org every 2 minutes)
// Must set CRON_SECRET env var and pass it as header: x-cron-secret
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = (process.env.NEXTAUTH_URL || process.env.APP_URL || req.nextUrl.origin).replace(/\/$/, "");
  const res = await fetch(`${origin}/api/payment/web2m/poll`, {
    method: "POST",
    headers: { "x-cron-secret": secret, "Content-Type": "application/json" },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
