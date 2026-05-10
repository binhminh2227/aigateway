// This file is intentionally minimal — Web2M works via polling, not redirect.
// See /api/payment/web2m/poll for the actual logic.
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ ok: true, mode: "polling" });
}
