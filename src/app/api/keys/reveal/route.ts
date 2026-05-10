import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Returns plaintext API key for the owner. Use sparingly — keys should ideally
// be saved at creation time. This endpoint exists so users who lose the key can
// re-copy it from the dashboard.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const apiKey = await prisma.apiKey.findFirst({
    where: { id, userId: session.user.id },
    select: { key: true },
  });
  if (!apiKey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ key: apiKey.key });
}
