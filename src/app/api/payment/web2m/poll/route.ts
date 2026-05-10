import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runWeb2mPoll } from "@/lib/web2m-poll";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const cronSecret = req.headers.get("x-cron-secret");
  if (session?.user?.role !== "admin" && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const r = await runWeb2mPoll();
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
