import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { sha256, maskKey } from "@/lib/crypto";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    // Never expose plaintext `key`/`keyHash` over GET. Plaintext is shown once on POST only.
    select: {
      id: true, name: true, keyPrefix: true, status: true, group: true,
      ipWhitelist: true, ipBlacklist: true, quotaLimit: true,
      rateLimitEnabled: true, limit5h: true, limitDaily: true, limit7d: true,
      expiresAt: true, lastUsed: true, createdAt: true,
    },
  });

  return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, group, customKey, ipWhitelist, ipBlacklist, quotaLimit, rateLimitEnabled, limit5h, limitDaily, limit7d, expiresAt } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  if (expiresAt !== undefined && expiresAt !== null) {
    const d = new Date(expiresAt);
    if (isNaN(d.getTime()) || d <= new Date()) {
      return NextResponse.json({ error: "expiresAt must be a valid future date" }, { status: 400 });
    }
  }

  const count = await prisma.apiKey.count({ where: { userId: session.user.id } });
  if (count >= 10) return NextResponse.json({ error: "Maximum 10 API keys allowed" }, { status: 400 });

  let key: string;
  if (customKey && customKey.trim().length >= 16) {
    if (!/^[a-zA-Z0-9_-]+$/.test(customKey.trim())) {
      return NextResponse.json({ error: "Custom key: only letters, numbers, underscores and hyphens allowed" }, { status: 400 });
    }
    const exists = await prisma.apiKey.findUnique({ where: { key: `sk-gw-${customKey.trim()}` } });
    if (exists) return NextResponse.json({ error: "Custom key already in use" }, { status: 400 });
    key = `sk-gw-${customKey.trim()}`;
  } else {
    key = `sk-gw-${uuidv4().replace(/-/g, "")}`;
  }

  const apiKey = await prisma.apiKey.create({
    data: {
      name,
      key,
      keyHash: sha256(key),
      keyPrefix: maskKey(key),
      userId: session.user.id,
      group: group?.trim() || null,
      ipWhitelist: ipWhitelist?.trim() || null,
      ipBlacklist: ipBlacklist?.trim() || null,
      quotaLimit: quotaLimit > 0 ? quotaLimit : null,
      rateLimitEnabled: !!rateLimitEnabled,
      limit5h: limit5h > 0 ? limit5h : null,
      limitDaily: limitDaily > 0 ? limitDaily : null,
      limit7d: limit7d > 0 ? limit7d : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  // Return plaintext key once for the client to copy. After this response the
  // server never exposes plaintext or hash again — only `keyPrefix` is shown thereafter.
  const { keyHash: _kh, key: _k, ...safe } = apiKey;
  void _kh; void _k;
  return NextResponse.json({ ...safe, key }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const key = await prisma.apiKey.findFirst({ where: { id, userId: session.user.id } });
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.apiKey.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, status, name, group, ipWhitelist, ipBlacklist, quotaLimit, rateLimitEnabled, limit5h, limitDaily, limit7d, expiresAt } = body;

  const key = await prisma.apiKey.findFirst({ where: { id, userId: session.user.id } });
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (status !== undefined) data.status = status;
  if (name !== undefined) data.name = name;
  if (group !== undefined) data.group = group?.trim() || null;
  if (ipWhitelist !== undefined) data.ipWhitelist = ipWhitelist?.trim() || null;
  if (ipBlacklist !== undefined) data.ipBlacklist = ipBlacklist?.trim() || null;
  if (quotaLimit !== undefined) data.quotaLimit = quotaLimit > 0 ? quotaLimit : null;
  if (rateLimitEnabled !== undefined) data.rateLimitEnabled = !!rateLimitEnabled;
  if (limit5h !== undefined) data.limit5h = limit5h > 0 ? limit5h : null;
  if (limitDaily !== undefined) data.limitDaily = limitDaily > 0 ? limitDaily : null;
  if (limit7d !== undefined) data.limit7d = limit7d > 0 ? limit7d : null;
  if (expiresAt !== undefined) {
    if (expiresAt !== null) {
      const d = new Date(expiresAt);
      if (isNaN(d.getTime()) || d <= new Date()) {
        return NextResponse.json({ error: "expiresAt must be a valid future date" }, { status: 400 });
      }
      data.expiresAt = d;
    } else {
      data.expiresAt = null;
    }
  }

  const updated = await prisma.apiKey.update({ where: { id }, data });
  return NextResponse.json(updated);
}
