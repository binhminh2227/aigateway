function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n * 256) + v;
  }
  return n >>> 0;
}

export function ipMatches(clientIp: string, rule: string): boolean {
  if (!clientIp || !rule) return false;
  const r = rule.trim();
  if (!r) return false;
  if (r === clientIp) return true;
  if (r.includes("/")) {
    const [base, bitsStr] = r.split("/");
    const bits = parseInt(bitsStr, 10);
    const c = ipv4ToInt(clientIp);
    const b = ipv4ToInt(base);
    if (c === null || b === null || isNaN(bits) || bits < 0 || bits > 32) return false;
    if (bits === 0) return true;
    const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0;
    return (c & mask) === (b & mask);
  }
  return false;
}

export function parseAclList(list: string | null | undefined): string[] {
  if (!list) return [];
  return list.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
}

export function ipMatchesAny(clientIp: string, list: string[]): boolean {
  return list.some(rule => ipMatches(clientIp, rule));
}

export function getClientIp(req: Request): string {
  const h = (k: string) => req.headers.get(k) || "";
  return (h("cf-connecting-ip")
    || h("x-real-ip")
    || h("x-forwarded-for").split(",")[0]
    || "").trim();
}
