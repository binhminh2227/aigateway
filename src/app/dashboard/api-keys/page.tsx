"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";

interface ApiKey {
  id: string;
  name: string;
  // Plaintext `key` is only present immediately after creation. Existing keys
  // expose only `keyPrefix` (masked) — the server no longer stores or returns plaintext.
  key?: string;
  keyPrefix: string;
  status: string;
  group?: string | null;
  lastUsed: string | null;
  createdAt: string;
  ipWhitelist?: string | null;
  ipBlacklist?: string | null;
  quotaLimit?: number | null;
  rateLimitEnabled?: boolean;
  limit5h?: number | null;
  limitDaily?: number | null;
  limit7d?: number | null;
  expiresAt?: string | null;
}

interface UsageStat {
  today: number;
  last30d: number;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-teal-500" : "bg-gray-600"}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

interface CreateFormData {
  name: string;
  group: string;
  customKeyEnabled: boolean;
  customKeyValue: string;
  ipRestriction: boolean;
  ipWhitelist: string;
  ipBlacklist: string;
  quotaLimit: string;
  rateLimitEnabled: boolean;
  limit5h: string;
  limitDaily: string;
  limit7d: string;
  expirationEnabled: boolean;
  expirationDays: number | null;
  expirationDate: string;
}

function CreateKeyModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: CreateFormData) => Promise<void> }) {
  const { t } = useLang();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<CreateFormData>({
    name: "", group: "", customKeyEnabled: false, customKeyValue: "",
    ipRestriction: false, ipWhitelist: "", ipBlacklist: "",
    quotaLimit: "", rateLimitEnabled: false,
    limit5h: "0", limitDaily: "0", limit7d: "0",
    expirationEnabled: false, expirationDays: 30, expirationDate: "",
  });

  function set<K extends keyof CreateFormData>(k: K, v: CreateFormData[K]) {
    setForm(p => ({ ...p, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (form.customKeyEnabled && form.customKeyValue.trim().length < 16) { setError("Custom key must be at least 16 characters"); return; }
    setSaving(true); setError("");
    try { await onCreate(form); onClose(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to create key"); }
    finally { setSaving(false); }
  }

  const expPresets = [7, 30, 90];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800">
          <h2 className="text-white font-semibold text-lg">{t.createModal.title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && <div className="bg-red-900/40 border border-red-700 text-red-400 text-sm px-3 py-2 rounded-lg">{error}</div>}

          {/* Name */}
          <div>
            <label className="block text-white text-sm font-medium mb-1.5">{t.createModal.name}</label>
            <input value={form.name} onChange={e => set("name", e.target.value)} placeholder={t.createModal.namePlaceholder}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:border-teal-500" />
          </div>

          {/* Group */}
          <div>
            <label className="block text-white text-sm font-medium mb-1.5">{t.createModal.group} <span className="text-gray-500 font-normal">{t.createModal.groupOpt}</span></label>
            <input value={form.group} onChange={e => set("group", e.target.value)} placeholder={t.createModal.groupPlaceholder}
              list="group-suggestions"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:border-teal-500" />
            <datalist id="group-suggestions">
              <option value="GPT Pro" />
            </datalist>
            <p className="text-gray-500 text-xs mt-1">Assign this key to a group to organize and filter your keys.</p>
          </div>

          {/* Custom Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white text-sm font-medium">Custom Key</label>
              <Toggle checked={form.customKeyEnabled} onChange={v => set("customKeyEnabled", v)} />
            </div>
            {form.customKeyEnabled && (
              <div>
                <input value={form.customKeyValue} onChange={e => set("customKeyValue", e.target.value)}
                  placeholder="Enter your custom key (min 16 chars)"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:border-teal-500 font-mono" />
                <p className="text-gray-500 text-xs mt-1">Only letters, numbers, underscores and hyphens allowed. Minimum 16 characters.</p>
              </div>
            )}
          </div>

          {/* IP Restriction */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white text-sm font-medium">IP Restriction</label>
              <Toggle checked={form.ipRestriction} onChange={v => set("ipRestriction", v)} />
            </div>
            {form.ipRestriction && (
              <div className="space-y-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">IP Whitelist</label>
                  <textarea value={form.ipWhitelist} onChange={e => set("ipWhitelist", e.target.value)}
                    placeholder={"192.168.1.100\n10.0.0.0/8"} rows={3}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-xs font-mono focus:border-teal-500 resize-none" />
                  <p className="text-gray-500 text-xs mt-1">One IP or CIDR per line. Only these IPs can use this key when set.</p>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">IP Blacklist</label>
                  <textarea value={form.ipBlacklist} onChange={e => set("ipBlacklist", e.target.value)}
                    placeholder={"1.2.3.4\n5.6.0.0/16"} rows={3}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-xs font-mono focus:border-teal-500 resize-none" />
                  <p className="text-gray-500 text-xs mt-1">One IP or CIDR per line. These IPs will be blocked from using this key.</p>
                </div>
              </div>
            )}
          </div>

          {/* Quota Limit */}
          <div>
            <label className="block text-white text-sm font-medium mb-1.5">Quota Limit</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
              <input type="number" min="0" step="0.01" value={form.quotaLimit} onChange={e => set("quotaLimit", e.target.value)}
                placeholder="Enter quota limit in USD"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-7 pr-3 py-2.5 text-sm focus:border-teal-500" />
            </div>
            <p className="text-gray-500 text-xs mt-1">Set the maximum amount this key can spend. 0 = unlimited.</p>
          </div>

          {/* Rate Limit */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-white text-sm font-medium">Rate Limit</label>
              <Toggle checked={form.rateLimitEnabled} onChange={v => set("rateLimitEnabled", v)} />
            </div>
            <p className="text-gray-500 text-xs mb-3">Set the maximum spending for this key within each time window. 0 = unlimited.</p>
            {form.rateLimitEnabled && (
              <div className="space-y-3">
                {[
                  { label: "5-Hour Limit (USD)", key: "limit5h" as const },
                  { label: "Daily Limit (USD)", key: "limitDaily" as const },
                  { label: "7-Day Limit (USD)", key: "limit7d" as const },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="block text-gray-400 text-xs mb-1">{label}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                      <input type="number" min="0" step="0.01" value={form[key]}
                        onChange={e => set(key, e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-7 pr-3 py-2.5 text-sm focus:border-teal-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expiration */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white text-sm font-medium">Expiration</label>
              <Toggle checked={form.expirationEnabled} onChange={v => set("expirationEnabled", v)} />
            </div>
            {form.expirationEnabled && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {expPresets.map(d => (
                    <button key={d} type="button" onClick={() => { set("expirationDays", d); const dt = new Date(Date.now() + d * 864e5); set("expirationDate", dt.toISOString().slice(0, 16)); }}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${form.expirationDays === d ? "bg-teal-600 border-teal-500 text-white" : "border-gray-700 text-gray-400 hover:text-white"}`}>
                      {d} days
                    </button>
                  ))}
                  <button type="button" onClick={() => set("expirationDays", null)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${form.expirationDays === null ? "bg-teal-600 border-teal-500 text-white" : "border-gray-700 text-gray-400 hover:text-white"}`}>
                    Custom
                  </button>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Expiration Date</label>
                  <input type="datetime-local" value={form.expirationDate} onChange={e => { set("expirationDate", e.target.value); set("expirationDays", null); }}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:border-teal-500" />
                  <p className="text-gray-500 text-xs mt-1">Select when this API key should expire.</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-800">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-700 text-gray-300 hover:text-white py-2.5 rounded-lg text-sm">{t.createModal.cancel}</button>
            <button type="submit" disabled={saving} className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium">
              {saving ? t.createModal.creating : t.createModal.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UseKeyModal({ apiKey, onClose }: { apiKey: ApiKey; onClose: () => void }) {
  const { t } = useLang();
  const [os, setOs] = useState<"mac" | "win">("win");
  const [copied, setCopied] = useState<string | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";

  async function copy(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const configPath = os === "mac" ? "~/.codex/config.toml" : "%userprofile%\\.codex\\config.toml";
  const authPath = os === "mac" ? "~/.codex/auth.json" : "%userprofile%\\.codex\\auth.json";
  const installCmd = os === "mac" ? "npm install -g @openai/codex" : "npm install -g @openai/codex";
  const mkdirCmd = os === "mac" ? "mkdir -p ~/.codex" : "mkdir %userprofile%\\.codex";
  const runCmd = "codex";

  const codexConfig = `model_provider = "OpenAI"
model = "gpt-4o"
review_model = "gpt-4o"
model_reasoning_effort = "xhigh"
disable_response_storage = true
network_access = "enabled"
windows_wsl_setup_acknowledged = true
model_context_window = 1000000
model_auto_compact_token_limit = 900000

[model_providers.OpenAI]
name = "OpenAI"
base_url = "${origin}/v1"
wire_api = "responses"
requires_openai_auth = true`;

  const fullKey = apiKey.key;
  const authJson = `{\n  "OPENAI_API_KEY": "${fullKey || "<your-api-key>"}"\n}`;

  const Block = ({ id, label, content }: { id: string; label: string; content: string }) => (
    <div>
      <div className="flex items-center justify-between bg-gray-800 rounded-t-lg px-4 py-2">
        <code className="text-gray-400 text-xs break-all">{label}</code>
        <button onClick={() => copy(content, id)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white whitespace-nowrap ml-3">
          {copied === id ? "✓ Copied" : "📋 Copy"}
        </button>
      </div>
      <pre className="bg-gray-950 rounded-b-lg p-4 text-xs text-gray-300 overflow-x-auto font-mono leading-relaxed whitespace-pre">{content}</pre>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800">
          <h2 className="text-white font-semibold text-lg">{t.useModal.title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800">✕</button>
        </div>
        <div className="px-6 pt-4">
          <p className="text-gray-400 text-sm mb-4">{t.useModal.desc}</p>
          <div className="flex gap-1 mb-5">
            {[{ key: "mac", label: "macOS / Linux", icon: "🍎" }, { key: "win", label: "Windows", icon: "⊞" }].map(o => (
              <button key={o.key} onClick={() => setOs(o.key as "mac" | "win")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${os === o.key ? "border-teal-600 bg-teal-900/30 text-teal-400" : "border-gray-700 text-gray-500 hover:text-gray-300"}`}>
                <span>{o.icon}</span>{o.label}
              </button>
            ))}
          </div>
          <div className="flex items-start gap-2 bg-yellow-900/20 border border-yellow-800/40 rounded-lg px-3 py-2 mb-4 text-xs text-yellow-400">
            <span>⚠</span><span>{t.useModal.warn}</span>
          </div>
          {!fullKey && (
            <div className="flex items-start gap-2 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2 mb-4 text-xs text-red-300">
              <span>🔒</span>
              <span>{t.useModal.missingKey}</span>
            </div>
          )}
          <div className="space-y-5 pb-6">
            <section>
              <h3 className="text-white text-sm font-semibold mb-1">{t.useModal.step1Title}</h3>
              <p className="text-gray-500 text-xs mb-2">{t.useModal.step1Desc}</p>
              <Block id="install" label={os === "mac" ? "Terminal" : "PowerShell / cmd"} content={installCmd} />
            </section>

            <section>
              <h3 className="text-white text-sm font-semibold mb-1">{t.useModal.step2Title}</h3>
              <p className="text-gray-500 text-xs mb-2">{t.useModal.step2Desc}</p>
              <Block id="mkdir" label={os === "mac" ? "Terminal" : "PowerShell / cmd"} content={mkdirCmd} />
            </section>

            <section>
              <h3 className="text-white text-sm font-semibold mb-1">{t.useModal.step3Title}</h3>
              <p className="text-gray-500 text-xs mb-2">{t.useModal.step3Desc}</p>
              <Block id="config" label={configPath} content={codexConfig} />
            </section>

            <section>
              <h3 className="text-white text-sm font-semibold mb-1">{t.useModal.step4Title}</h3>
              <p className="text-gray-500 text-xs mb-2">{t.useModal.step4Desc}</p>
              <Block id="auth" label={authPath} content={authJson} />
            </section>

            <section>
              <h3 className="text-white text-sm font-semibold mb-1">{t.useModal.step5Title}</h3>
              <p className="text-gray-500 text-xs mb-2">{t.useModal.step5Desc}</p>
              <Block id="run" label={os === "mac" ? "Terminal" : "PowerShell / cmd"} content={runCmd} />
            </section>

            <section>
              <h3 className="text-white text-sm font-semibold mb-1">{t.useModal.step6Title}</h3>
              <p className="text-gray-500 text-xs">{t.useModal.step6Desc}</p>
            </section>

            <section className="bg-gray-800/40 border border-gray-700/60 rounded-lg p-3">
              <h3 className="text-teal-400 text-sm font-semibold mb-2">💡 {t.useModal.tipsTitle}</h3>
              <ul className="text-xs text-gray-400 space-y-1.5 list-disc pl-5">
                <li>{t.useModal.tip1}</li>
                <li>{t.useModal.tip2}</li>
                <li>{t.useModal.tip3}</li>
              </ul>
            </section>
          </div>
        </div>
        <div className="px-6 pb-5 flex justify-end border-t border-gray-800 pt-4">
          <button onClick={onClose} className="border border-gray-700 text-gray-300 hover:text-white px-5 py-2 rounded-lg text-sm">{t.useModal.close}</button>
        </div>
      </div>
    </div>
  );
}

export default function ApiKeysPage() {
  const { t } = useLang();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [usageStats, setUsageStats] = useState<Record<string, UsageStat>>({});
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [useKeyModal, setUseKeyModal] = useState<ApiKey | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function loadKeys() {
    const [keysRes, billingRes] = await Promise.all([
      fetch("/api/keys"),
      fetch("/api/billing"),
    ]);
    const keysData: ApiKey[] = await keysRes.json();
    const billing = await billingRes.json();
    setKeys(keysData);

    // Build usage stats per key from usage logs
    const stats: Record<string, UsageStat> = {};
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d30 = new Date(Date.now() - 30 * 864e5);
    for (const log of (billing.usageLogs || [])) {
      const keyId = log.apiKeyId;
      if (!stats[keyId]) stats[keyId] = { today: 0, last30d: 0 };
      const t = new Date(log.createdAt);
      if (t >= today) stats[keyId].today += log.cost;
      if (t >= d30) stats[keyId].last30d += log.cost;
    }
    setUsageStats(stats);
    setLoading(false);
  }

  useEffect(() => { loadKeys(); }, []);

  async function createKey(form: CreateFormData) {
    const expiresAt = form.expirationEnabled && form.expirationDate ? form.expirationDate : null;
    const res = await fetch("/api/keys", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        group: form.group.trim() || undefined,
        customKey: form.customKeyEnabled ? form.customKeyValue : undefined,
        ipWhitelist: form.ipRestriction ? form.ipWhitelist : undefined,
        ipBlacklist: form.ipRestriction ? form.ipBlacklist : undefined,
        quotaLimit: parseFloat(form.quotaLimit) || 0,
        rateLimitEnabled: form.rateLimitEnabled,
        limit5h: parseFloat(form.limit5h) || 0,
        limitDaily: parseFloat(form.limitDaily) || 0,
        limit7d: parseFloat(form.limit7d) || 0,
        expiresAt,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create key");
    setKeys(prev => [data, ...prev]);
  }

  async function toggleKey(id: string, current: string) {
    const newStatus = current === "active" ? "inactive" : "active";
    await fetch("/api/keys", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: newStatus }) });
    setKeys(prev => prev.map(k => k.id === id ? { ...k, status: newStatus } : k));
  }

  async function deleteKey(id: string) {
    if (!confirm("Delete this API key? This action cannot be undone.")) return;
    await fetch("/api/keys", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setKeys(prev => prev.filter(k => k.id !== id));
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  const allGroups = Array.from(new Set(keys.map(k => k.group).filter(Boolean))) as string[];

  const filtered = keys.filter(k => {
    const matchSearch = k.name.toLowerCase().includes(search.toLowerCase()) || (k.keyPrefix || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || k.status === statusFilter;
    const matchGroup = groupFilter === "all" || k.group === groupFilter;
    return matchSearch && matchStatus && matchGroup;
  });

  const truncateKey = (key: string) => `${key.slice(0, 7)}...${key.slice(-4)}`;

  return (
    <div>
      {useKeyModal && <UseKeyModal apiKey={useKeyModal} onClose={() => setUseKeyModal(null)} />}
      {showCreateModal && <CreateKeyModal onClose={() => setShowCreateModal(false)} onCreate={createKey} />}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">{t.keys.title}</h1>
          <p className="text-gray-400 text-sm mt-0.5">{t.keys.subtitle}</p>
        </div>
        <button onClick={() => setShowCreateModal(true)}
          className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          {t.keys.create}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">🔍</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t.keys.search}
            className="bg-gray-900 border border-gray-700 text-white rounded-lg pl-8 pr-4 py-2 text-sm w-52 focus:border-teal-500" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="all">{t.keys.allStatus}</option>
          <option value="active">{t.keys.statusActive}</option>
          <option value="inactive">{t.keys.statusInactive}</option>
        </select>
        {allGroups.length > 0 && (
          <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="all">{t.keys.allGroups}</option>
            {allGroups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
      </div>

      {/* API Endpoints bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs">
          <span className="text-gray-400 font-medium">{t.keys.apiEndpoints}</span>
          <span className="bg-teal-900/40 text-teal-400 border border-teal-800/50 px-1.5 py-0.5 rounded text-xs">Default</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-300 font-mono">{origin}/v1</span>
          <button onClick={() => copyKey(`${origin}/v1`)} className="text-gray-500 hover:text-gray-300">📋</button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-3xl mb-3">🔑</p>
            <p className="font-medium text-gray-300 mb-1">{t.keys.noKeys}</p>
            <p className="text-sm">{t.keys.noKeysSub}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b border-gray-800 bg-gray-900/80">
                  <th className="px-4 py-3 text-left">{t.keys.name}</th>
                  <th className="px-4 py-3 text-left">{t.keys.apiKey}</th>
                  <th className="px-4 py-3 text-left">{t.keys.usageCol}</th>
                  <th className="px-4 py-3 text-left">{t.keys.expires}</th>
                  <th className="px-4 py-3 text-left">{t.keys.status}</th>
                  <th className="px-4 py-3 text-left">{t.keys.lastUsed}</th>
                  <th className="px-4 py-3 text-right">{t.keys.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map(k => {
                  const stat = usageStats[k.id] || { today: 0, last30d: 0 };
                  const quota = k.quotaLimit ?? 0;
                  const quotaUsed = stat.last30d;
                  const quotaPct = quota > 0 ? Math.min(100, (quotaUsed / quota) * 100) : 0;
                  return (
                    <tr key={k.id} className="hover:bg-gray-800/30">
                      <td className="px-4 py-4">
                        <div className="font-medium text-white text-sm">{k.name}</div>
                        {k.group && (
                          <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-900/40 text-indigo-300 border border-indigo-800/50">
                            {k.group}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <code className="text-teal-400 font-mono text-xs bg-gray-800/60 px-2 py-1 rounded border border-gray-700">
                            {k.key ? truncateKey(k.key) : k.keyPrefix}
                          </code>
                          <button onClick={() => copyKey(k.key || k.keyPrefix)} className="text-gray-500 hover:text-gray-300 text-xs" title={k.key ? "Copy" : "Copy prefix (full key only available at creation)"}>
                            {copiedKey === (k.key || k.keyPrefix) ? "✅" : "📋"}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4 min-w-[160px]">
                        <div className="text-xs space-y-0.5">
                          <div className="flex gap-2">
                            <span className="text-gray-500">Today:</span>
                            <span className="text-white font-medium">${stat.today.toFixed(4)}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-gray-500">Last 30d:</span>
                            <span className="text-white font-medium">${stat.last30d.toFixed(4)}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-gray-500">Quota:</span>
                            <span className="text-white font-medium">${quotaUsed.toFixed(2)} / {quota > 0 ? `$${quota.toFixed(2)}` : "∞"}</span>
                          </div>
                          <div className="w-32 bg-gray-700 rounded-full h-1 mt-1">
                            <div className="bg-teal-500 h-1 rounded-full" style={{ width: `${quotaPct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-500 text-xs">{t.keys.never}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                          k.status === "active" ? "bg-green-900/30 text-green-400 border border-green-800/50" : "bg-gray-800 text-gray-500 border border-gray-700"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${k.status === "active" ? "bg-green-400" : "bg-gray-500"}`} />
                          {k.status === "active" ? t.keys.statusActive : t.keys.statusInactive}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-400 text-xs">
                        {k.lastUsed ? new Date(k.lastUsed).toLocaleString("vi-VN") : "-"}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => setUseKeyModal(k)}
                            className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-teal-400 transition-colors group">
                            <span className="text-base border border-gray-700 group-hover:border-teal-600 rounded p-1">⊡</span>
                            <span className="text-[10px]">{t.keys.useKey}</span>
                          </button>
                          <button onClick={() => toggleKey(k.id, k.status)}
                            className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-yellow-400 transition-colors">
                            <span className="text-base">⊘</span>
                            <span className="text-[10px]">{k.status === "active" ? t.keys.disable : t.keys.enable}</span>
                          </button>
                          <button onClick={() => deleteKey(k.id)}
                            className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-red-400 transition-colors">
                            <span className="text-base">🗑</span>
                            <span className="text-[10px]">{t.keys.delete}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination info */}
      {filtered.length > 0 && (
        <div className="mt-3 text-xs text-gray-500 px-1">
          Showing 1 to {filtered.length} of {filtered.length} results
        </div>
      )}
    </div>
  );
}
