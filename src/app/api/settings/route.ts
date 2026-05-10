import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const PUBLIC_KEYS = [
  "bank_name", "bank_account", "bank_holder", "bank_content",
  "usdt_trc20", "usdt_erc20", "usdt_rate",
  "web2m_enabled", "web2m_bank_bin", "web2m_vietqr",
  "usd_to_vnd", "bank_manual_enabled",
];
const BANK_KEYS = ["bank_name", "bank_account", "bank_holder", "bank_content", "web2m_bank_bin", "web2m_vietqr"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.setting.findMany({ where: { key: { in: PUBLIC_KEYS } } });
  const map = Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
  // Hide bank info from end users when manual bank toggle is off
  if (map.bank_manual_enabled !== "1") {
    for (const k of BANK_KEYS) delete map[k];
  }
  return NextResponse.json(map);
}
