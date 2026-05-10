"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLang, LangToggle } from "@/lib/i18n";

interface Stats { totalUsers: number; activeKeys: number; totalRevenue: number; pendingTopups: number; todayRevenue?: number; todayRequests?: number; }
interface Analytics { totalTopup: number; totalPlan: number; totalBalance: number; totalUsers: number; bannedUsers: number; topModels: { model: string; cost: number }[]; weekRevenue: { date: string; revenue: number; requests: number }[]; }
interface User { id: string; email: string; name: string; balance: number; redeemBalance: number; redeemExpiresAt: string | null; role: string; banned: boolean; dailyLimit: number; planExpiresAt: string | null; createdAt: string; _count: { apiKeys: number; usageLogs: number }; }
interface Transaction { id: string; amount: number; method: string; status: string; note: string; createdAt: string; user: { email: string; name: string }; }
interface RedeemCode { id: string; code: string; amount: number; note: string | null; usedBy: string | null; usedAt: string | null; expiresAt: string | null; creditDays: number | null; createdAt: string; }
interface ModelPricing { id: string; model: string; inputPrice: number; outputPrice: number; tcdmxInputPrice: number; tcdmxOutputPrice: number; tcdmxCachePrice: number; tcdmxTier: number; markup: number; flatCostPerCall: number | null; enabled: boolean; }
interface Plan { id: string; name: string; price: number; duration: number; dailyLimit: number; concurrencyLimit: number; description: string | null; features: string; enabled: boolean; sortOrder: number; }
interface TcdmxKey { id: string; key: string; label: string | null; provider: string; status: string; lastUsed: string | null; errorCount: number; createdAt: string; }

const PROVIDERS: { value: string; label: string; badge: string }[] = [
  { value: "tcdmx", label: "TCDMX", badge: "bg-purple-900/30 text-purple-300 border-purple-800/50" },
  // future: { value: "openrouter", label: "OpenRouter", badge: "bg-blue-900/30 text-blue-300 border-blue-800/50" },
  // future: { value: "anthropic", label: "Anthropic", badge: "bg-orange-900/30 text-orange-300 border-orange-800/50" },
  // future: { value: "openai",    label: "OpenAI",    badge: "bg-green-900/30 text-green-300 border-green-800/50" },
];

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useLang();
  const [tab, setTab] = useState<"stats" | "analytics" | "users" | "topups" | "redeem" | "pricing" | "plans" | "tcdmx" | "payment" | "api">("stats");
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  // user action modals
  const [userModal, setUserModal] = useState<{ type: "add_balance" | "change_password"; user: User } | null>(null);
  const [modalInput, setModalInput] = useState("");
  const [modalNote, setModalNote] = useState("");
  const [modalSaving, setModalSaving] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [redeemCodes, setRedeemCodes] = useState<RedeemCode[]>([]);
  const [modelPricing, setModelPricing] = useState<ModelPricing[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [paymentSettings, setPaymentSettings] = useState<Record<string, string>>({
    bank_name: "", bank_account: "", bank_holder: "", bank_content: "",
    usdt_trc20: "", usdt_erc20: "", usdt_rate: "1",
    web2m_enabled: "0", web2m_access_token: "",
    web2m_bank_bin: "", web2m_vietqr: "1",
    usd_to_vnd: "",
  });
  const [pollingNow, setPollingNow] = useState(false);
  const [pollResult, setPollResult] = useState<string | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tcdmxKeys, setTcdmxKeys] = useState<TcdmxKey[]>([]);
  const [newTcdmxKey, setNewTcdmxKey] = useState({ key: "", label: "", provider: "tcdmx" });
  const [addingKey, setAddingKey] = useState(false);
  const [reconcile, setReconcile] = useState<null | { quota?: { used: number; remaining: number; limit: number; unit: string }; model_stats?: Array<{ model: string; cost: number; actual_cost: number; requests: number }>; myRevenue: number; myComputedTcdmxCost: number; realTcdmxUsed: number; drift: number; profit: number; profitMargin: number; error?: string }>(null);
  const [reconciling, setReconciling] = useState(false);
  async function runReconcile() {
    setReconciling(true);
    try {
      const res = await fetch("/api/admin?type=tcdmx_reconcile");
      const d = await res.json();
      setReconcile(res.ok ? d : { error: d.error || "Failed", myRevenue: 0, myComputedTcdmxCost: 0, realTcdmxUsed: 0, drift: 0, profit: 0, profitMargin: 0 });
    } finally { setReconciling(false); }
  }
  const [loading, setLoading] = useState(true);
  // pricing edit state
  const [editingPricing, setEditingPricing] = useState<Record<string, { tcdmxInputPrice: string; tcdmxOutputPrice: string; tcdmxCachePrice: string; tcdmxTier: string; markup: string; flatCostPerCall: string; enabled: boolean }>>({});
  const [newModel, setNewModel] = useState({ model: "", tcdmxInputPrice: "", tcdmxOutputPrice: "", tcdmxCachePrice: "", tcdmxTier: "2.0", markup: "1.3", flatCostPerCall: "" });
  const [savingPricing, setSavingPricing] = useState(false);
  const [pricingAudit, setPricingAudit] = useState<{ audit: any[]; fetchedAt: string } | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  // plan edit state
  const [editPlan, setEditPlan] = useState<Partial<Plan> & { featuresText?: string } | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [newCodeAmount, setNewCodeAmount] = useState("");
  const [newCodeCount, setNewCodeCount] = useState("1");
  const [newCodeNote, setNewCodeNote] = useState("");
  const [newCodeExpireDays, setNewCodeExpireDays] = useState("");
  const [newCodeCreditDays, setNewCodeCreditDays] = useState("");
  const [creatingCode, setCreatingCode] = useState(false);
  const [createdCodes, setCreatedCodes] = useState<string[]>([]);
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [apiTokenVisible, setApiTokenVisible] = useState(false);
  const [apiTokenSaving, setApiTokenSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated" && session?.user?.role !== "admin") { router.push("/dashboard"); }
  }, [status, session, router]);

  useEffect(() => {
    const done = () => setLoading(false);

    // Background prefetch for stats (never drives loading state for other tabs)
    if (tab !== "stats" && !stats) {
      fetch("/api/admin?type=stats").then(r => r.json()).then(d => { setStats(d); }).catch(() => null);
    }

    if (tab === "stats") {
      fetch("/api/admin?type=stats").then(r => r.json()).then(d => { setStats(d); }).catch(console.error).finally(done);
    } else if (tab === "analytics") {
      setLoading(true);
      fetch("/api/admin?type=analytics").then(r => r.json()).then(d => {
        if (d && typeof d.totalTopup === "number") setAnalytics(d);
      }).catch(console.error).finally(done);
    } else if (tab === "users") {
      setLoading(true);
      fetch("/api/admin?type=users").then(r => r.json()).then(d => { setUsers(d.users || d); }).catch(console.error).finally(done);
    } else if (tab === "topups") {
      setLoading(true);
      fetch("/api/admin?type=transactions").then(r => r.json()).then(d => { setTransactions(d.transactions || d); }).catch(console.error).finally(done);
    } else if (tab === "redeem") {
      setLoading(true);
      Promise.all([
        fetch("/api/admin?type=redeem_codes").then(r => r.json()),
        fetch("/api/admin?type=settings").then(r => r.json()),
      ]).then(([codes, s]) => {
        if (Array.isArray(codes)) setRedeemCodes(codes);
        if (s && typeof s === "object") setSettings(prev => ({ ...prev, ...s }));
      }).catch(console.error).finally(done);
    } else if (tab === "tcdmx") {
      setLoading(true);
      fetch("/api/admin?type=tcdmx_keys").then(r => r.json()).then(d => { if (Array.isArray(d)) setTcdmxKeys(d); }).catch(console.error).finally(done);
      // Auto-load reconcile/balance so admin sees TCDMX quota & profit on tab open
      runReconcile();
    } else if (tab === "pricing") {
      setLoading(true);
      Promise.all([
        fetch("/api/admin?type=model_pricing").then(r => r.json()),
        fetch("/api/admin?type=settings").then(r => r.json()),
      ]).then(([pricing, s]) => {
        if (Array.isArray(pricing)) {
          setModelPricing(pricing);
          const init: Record<string, { tcdmxInputPrice: string; tcdmxOutputPrice: string; tcdmxCachePrice: string; tcdmxTier: string; markup: string; flatCostPerCall: string; enabled: boolean }> = {};
          for (const p of pricing) init[p.id] = { tcdmxInputPrice: String(p.tcdmxInputPrice ?? 0), tcdmxOutputPrice: String(p.tcdmxOutputPrice ?? 0), tcdmxCachePrice: String(p.tcdmxCachePrice ?? 0), tcdmxTier: String(p.tcdmxTier ?? 2.0), markup: String(p.markup ?? 1.3), flatCostPerCall: p.flatCostPerCall != null ? String(p.flatCostPerCall) : "", enabled: p.enabled };
          setEditingPricing(init);
        }
        if (s && typeof s === "object") setSettings(s);
      }).catch(console.error).finally(done);
    } else if (tab === "plans") {
      setLoading(true);
      Promise.all([
        fetch("/api/admin?type=plans").then(r => r.json()),
        fetch("/api/admin?type=settings").then(r => r.json()),
      ]).then(([plansData, s]) => {
        if (Array.isArray(plansData)) setPlans(plansData);
        if (s && typeof s === "object") setPaymentSettings(prev => ({ ...prev, usd_to_vnd: s.usd_to_vnd || "" }));
      }).catch(console.error).finally(done);
    } else if (tab === "payment") {
      setLoading(true);
      fetch("/api/admin?type=settings").then(r => r.json()).then(d => {
        if (!d || typeof d !== "object") return;
        setPaymentSettings(prev => ({
          ...prev,
          bank_name: d.bank_name || "",
          bank_account: d.bank_account || "",
          bank_holder: d.bank_holder || "",
          bank_content: d.bank_content || "",
          usdt_trc20: d.usdt_trc20 || "",
          usdt_erc20: d.usdt_erc20 || "",
          usdt_rate: d.usdt_rate || "1",
          web2m_enabled: d.web2m_enabled || "0",
          web2m_access_token: d.web2m_access_token || "",
          web2m_bank_bin: d.web2m_bank_bin || "",
          web2m_vietqr: d.web2m_vietqr || "1",
          usd_to_vnd: d.usd_to_vnd || "",
        }));
      }).catch(console.error).finally(done);
    } else if (tab === "api") {
      setLoading(true);
      fetch("/api/admin?type=admin_api_token").then(r => r.json()).then(d => {
        setApiToken(d?.token || null);
      }).catch(console.error).finally(done);
    }
  }, [tab]);

  async function generateApiToken() {
    if (apiToken && !confirm("Tạo token mới sẽ vô hiệu hoá token cũ. Tiếp tục?")) return;
    setApiTokenSaving(true);
    try {
      const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate_admin_api_token" }) });
      const d = await res.json();
      if (res.ok) { setApiToken(d.token); setApiTokenVisible(true); }
    } finally { setApiTokenSaving(false); }
  }

  async function revokeApiToken() {
    if (!confirm("Vô hiệu hoá token API? Các tích hợp đang dùng sẽ ngừng hoạt động.")) return;
    setApiTokenSaving(true);
    try {
      const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "revoke_admin_api_token" }) });
      if (res.ok) { setApiToken(null); setApiTokenVisible(false); }
    } finally { setApiTokenSaving(false); }
  }

  async function approveTopup(id: string) {
    await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve_topup", txId: id }) });
    setTransactions((prev) => prev.map((t) => t.id === id ? { ...t, status: "completed" } : t));
  }

  async function rejectTopup(id: string) {
    await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject_topup", txId: id }) });
    setTransactions((prev) => prev.map((t) => t.id === id ? { ...t, status: "failed" } : t));
  }

  async function createRedeemCodes() {
    const amount = parseFloat(newCodeAmount);
    if (!amount || amount <= 0) return;
    setCreatingCode(true);
    try {
      const payload: Record<string, unknown> = {
        action: "create_redeem_code", amount, count: parseInt(newCodeCount) || 1, note: newCodeNote || undefined,
      };
      if (newCodeExpireDays) payload.expireDays = parseInt(newCodeExpireDays);
      if (newCodeCreditDays) payload.creditDays = parseInt(newCodeCreditDays);
      const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const codes = await res.json();
      if (Array.isArray(codes)) {
        setCreatedCodes(codes.map((c: RedeemCode) => c.code));
        setRedeemCodes((prev) => [...codes, ...prev]);
        setNewCodeAmount(""); setNewCodeCount("1"); setNewCodeNote(""); setNewCodeExpireDays(""); setNewCodeCreditDays("");
      } else {
        alert(codes.error || "Failed to create codes");
      }
    } catch {
      alert("Network error");
    } finally {
      setCreatingCode(false);
    }
  }

  async function cleanupExpiredCodes() {
    const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cleanup_expired_codes" }) });
    const d = await res.json();
    setRedeemCodes(prev => prev.filter(c => !c.expiresAt || new Date(c.expiresAt) >= new Date() || c.usedBy));
    alert(`Đã xóa ${d.deleted} mã hết hạn chưa dùng`);
  }

  async function deleteRedeemCode(id: string) {
    await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_redeem_code", id }) });
    setRedeemCodes((prev) => prev.filter((c) => c.id !== id));
  }

  async function addTcdmxKey() {
    if (!newTcdmxKey.key.trim()) return;
    setAddingKey(true);
    const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_tcdmx_key", key: newTcdmxKey.key.trim(), label: newTcdmxKey.label, provider: newTcdmxKey.provider }) });
    const row = await res.json();
    if (res.ok) { setTcdmxKeys(prev => [row, ...prev.filter(k => k.id !== row.id)]); setNewTcdmxKey({ key: "", label: "", provider: newTcdmxKey.provider }); }
    setAddingKey(false);
  }

  async function toggleTcdmxKey(id: string) {
    const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_tcdmx_key", id }) });
    const row = await res.json();
    if (res.ok) setTcdmxKeys(prev => prev.map(k => k.id === id ? { ...k, status: row.status } : k));
  }

  async function deleteTcdmxKey(id: string) {
    await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_tcdmx_key", id }) });
    setTcdmxKeys(prev => prev.filter(k => k.id !== id));
  }

  async function resetTcdmxKeyErrors(id: string) {
    await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_tcdmx_key_errors", id }) });
    setTcdmxKeys(prev => prev.map(k => k.id === id ? { ...k, errorCount: 0, status: "active" } : k));
  }

  async function savePricing() {
    setSavingPricing(true);
    for (const p of modelPricing) {
      const e = editingPricing[p.id];
      if (!e) continue;
      await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert_model_pricing", model: p.model, tcdmxInputPrice: e.tcdmxInputPrice, tcdmxOutputPrice: e.tcdmxOutputPrice, tcdmxCachePrice: e.tcdmxCachePrice, tcdmxTier: e.tcdmxTier, markup: e.markup, flatCostPerCall: e.flatCostPerCall, enabled: e.enabled }) });
    }
    const pricingSettings = {
      price_markup: settings.price_markup || "1.3",
      default_concurrency: settings.default_concurrency || "5",
    };
    const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_settings", settings: pricingSettings }) });
    setSavingPricing(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert("Save failed: " + (j.error || res.status)); return; }
    alert("Saved!");
  }

  async function addNewModel() {
    if (!newModel.model || !newModel.tcdmxInputPrice || !newModel.tcdmxOutputPrice) return;
    const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert_model_pricing", ...newModel }) });
    const row = await res.json();
    setModelPricing(prev => [...prev, row]);
    setEditingPricing(prev => ({ ...prev, [row.id]: { tcdmxInputPrice: String(row.tcdmxInputPrice), tcdmxOutputPrice: String(row.tcdmxOutputPrice), tcdmxCachePrice: String(row.tcdmxCachePrice ?? 0), tcdmxTier: String(row.tcdmxTier), markup: String(row.markup), flatCostPerCall: row.flatCostPerCall != null ? String(row.flatCostPerCall) : "", enabled: row.enabled } }));
    setNewModel({ model: "", tcdmxInputPrice: "", tcdmxOutputPrice: "", tcdmxCachePrice: "", tcdmxTier: "2.0", markup: "1.3", flatCostPerCall: "" });
  }
  async function runPricingAudit() {
    setAuditLoading(true); setAuditError(null);
    try {
      const r = await fetch("/api/admin?type=pricing_audit");
      const j = await r.json();
      if (!r.ok) { setAuditError(j.error || `HTTP ${r.status}`); setPricingAudit(null); }
      else setPricingAudit(j);
    } catch (e) { setAuditError(String(e)); }
    finally { setAuditLoading(false); }
  }

  async function deletePricingRow(id: string) {
    await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_model_pricing", id }) });
    setModelPricing(prev => prev.filter(p => p.id !== id));
  }

  async function pollWeb2mNow() {
    setPollingNow(true);
    setPollResult(null);
    const res = await fetch("/api/payment/web2m/poll", { method: "POST" });
    const d = await res.json();
    setPollResult(d.message || (d.matched > 0 ? `✓ Cộng ${d.matched} giao dịch` : "Không có giao dịch mới"));
    setPollingNow(false);
  }

  async function savePaymentConfig() {
    setSavingPayment(true);
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_settings", settings: paymentSettings }),
    });
    setSavingPayment(false);
    setPaymentSaved(true);
    setTimeout(() => setPaymentSaved(false), 3000);
  }

  async function saveCreditRate() {
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_settings", settings: { usd_to_vnd: paymentSettings.usd_to_vnd || "0" } }),
    });
    setPaymentSaved(true);
    setTimeout(() => setPaymentSaved(false), 2500);
  }

  async function savePlan() {
    if (!editPlan) return;
    setSavingPlan(true);
    const features = (editPlan.featuresText || "").split("\n").map(s => s.trim()).filter(Boolean);
    const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert_plan", ...editPlan, features }) });
    const row = await res.json();
    setPlans(prev => editPlan.id ? prev.map(p => p.id === row.id ? row : p) : [...prev, row]);
    setEditPlan(null);
    setSavingPlan(false);
  }

  async function deletePlan(id: string) {
    await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_plan", id }) });
    setPlans(prev => prev.filter(p => p.id !== id));
  }

  async function handleModalSave() {
    if (!userModal) return;
    setModalSaving(true);
    const { type, user } = userModal;
    if (type === "add_balance") {
      const amount = parseFloat(modalInput);
      if (!amount || amount <= 0) { setModalSaving(false); return; }
      const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_balance", userId: user.id, amount, note: modalNote || undefined }) });
      if (res.ok) setUsers(prev => prev.map(u => u.id === user.id ? { ...u, balance: u.balance + amount } : u));
    } else if (type === "change_password") {
      if (modalInput.length < 6) { setModalSaving(false); return; }
      await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_password", userId: user.id, password: modalInput }) });
    }
    setModalSaving(false);
    setUserModal(null);
    setModalInput("");
    setModalNote("");
  }

  async function toggleBan(user: User) {
    const action = user.banned ? "unban_user" : "ban_user";
    const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId: user.id }) });
    if (res.ok) setUsers(prev => prev.map(u => u.id === user.id ? { ...u, banned: !u.banned } : u));
  }

  if (status === "loading" || !session) return null;

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 fixed h-full flex flex-col">
        <div className="px-5 py-5 border-b border-gray-800">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-700 flex items-center justify-center text-white font-bold text-sm">A</div>
            <span className="font-semibold text-white">{t.admin.title}</span>
          </Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { key: "stats", label: t.admin.tabs.dashboard, icon: "⊞" },
            { key: "analytics", label: "Analytics", icon: "📈" },
            { key: "users", label: t.admin.tabs.users, icon: "👥" },
            { key: "topups", label: t.admin.tabs.topups, icon: "💰" },
            { key: "redeem", label: t.admin.tabs.redeem, icon: "🎁" },
            { key: "tcdmx", label: t.admin.tabs.tcdmx, icon: "🔑" },
            { key: "pricing", label: t.admin.tabs.pricing, icon: "💲" },
            { key: "plans", label: t.admin.tabs.plans, icon: "📦" },
            { key: "payment", label: t.admin.tabs.payment, icon: "💳" },
            { key: "api", label: "API", icon: "🔌" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key as typeof tab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                tab === item.key ? "bg-purple-700 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-gray-800 space-y-2">
          <LangToggle className="w-full justify-center" />
          <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white text-sm">
            ← {t.admin.backToDash}
          </Link>
        </div>
      </aside>

      {/* User action modal */}
      {userModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-bold mb-1">
              {userModal.type === "add_balance" ? "💳 Nạp tiền thủ công" : "🔑 Đổi mật khẩu"}
            </h3>
            <p className="text-gray-500 text-xs mb-5">{userModal.user.email}</p>

            {userModal.type === "add_balance" ? (
              <div className="space-y-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Số credit nạp</label>
                  <input type="number" min="0.01" step="0.01" value={modalInput}
                    onChange={e => setModalInput(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm"
                    placeholder="VD: 10.00" autoFocus />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Ghi chú (tuỳ chọn)</label>
                  <input type="text" value={modalNote} onChange={e => setModalNote(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm"
                    placeholder="VD: Nạp bù tháng 5" />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-gray-400 text-xs block mb-1">Mật khẩu mới (ít nhất 6 ký tự)</label>
                <input type="password" value={modalInput} onChange={e => setModalInput(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm"
                  placeholder="••••••••" autoFocus />
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={handleModalSave} disabled={modalSaving || !modalInput}
                className="flex-1 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white py-2.5 rounded-lg text-sm font-medium">
                {modalSaving ? "Đang lưu..." : "Xác nhận"}
              </button>
              <button onClick={() => { setUserModal(null); setModalInput(""); setModalNote(""); }}
                className="flex-1 border border-gray-700 text-gray-400 py-2.5 rounded-lg text-sm">
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 ml-56 p-8">
        {tab === "analytics" && (
          <div>
            <h1 className="text-2xl font-bold text-white mb-6">📈 Analytics</h1>
            {loading ? (
              <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : !analytics ? (
              <div className="text-center py-20 text-gray-500">
                <p className="text-3xl mb-3">⚠</p>
                <p>Không tải được dữ liệu analytics. Thử lại sau.</p>
                <button onClick={() => { setLoading(true); fetch("/api/admin?type=analytics").then(r => r.json()).then(d => { if (d?.totalTopup !== undefined) setAnalytics(d); }).finally(() => setLoading(false)); }}
                  className="mt-4 text-sm text-purple-400 hover:text-purple-300 border border-purple-800/40 px-4 py-2 rounded-lg">
                  Thử lại
                </button>
              </div>
            ) : (
              <>
                {/* Financial summary */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <div className="bg-gray-900 border border-green-800/50 rounded-xl p-5">
                    <p className="text-xs text-green-400 uppercase tracking-wider mb-1">Tổng tiền nạp</p>
                    <p className="text-2xl font-bold text-white">{analytics.totalTopup.toFixed(2)}<span className="text-sm font-normal text-green-400 ml-1">cr</span></p>
                    <p className="text-gray-600 text-xs mt-1">Tất cả giao dịch topup completed</p>
                  </div>
                  <div className="bg-gray-900 border border-blue-800/50 rounded-xl p-5">
                    <p className="text-xs text-blue-400 uppercase tracking-wider mb-1">Tổng tiền mua gói</p>
                    <p className="text-2xl font-bold text-white">{analytics.totalPlan.toLocaleString("vi-VN")}<span className="text-sm font-normal text-blue-400 ml-1">₫</span></p>
                    <p className="text-gray-600 text-xs mt-1">Tất cả giao dịch subscribe completed</p>
                  </div>
                  <div className="bg-gray-900 border border-teal-800/50 rounded-xl p-5">
                    <p className="text-xs text-teal-400 uppercase tracking-wider mb-1">Số dư khả dụng</p>
                    <p className="text-2xl font-bold text-white">{analytics.totalBalance.toFixed(2)}<span className="text-sm font-normal text-teal-400 ml-1">cr</span></p>
                    <p className="text-gray-600 text-xs mt-1">Tổng số dư của tất cả user</p>
                  </div>
                  <div className="bg-gray-900 border border-purple-800/50 rounded-xl p-5">
                    <p className="text-xs text-purple-400 uppercase tracking-wider mb-1">Tài khoản</p>
                    <p className="text-2xl font-bold text-white">{analytics.totalUsers}</p>
                    <p className="text-xs mt-1">
                      {analytics.bannedUsers > 0
                        ? <span className="text-red-400">{analytics.bannedUsers} bị khóa</span>
                        : <span className="text-gray-600">Không có ban</span>}
                    </p>
                  </div>
                </div>

                {/* 7-day revenue chart (simple bars) */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                  <h2 className="text-white font-semibold mb-4">Doanh thu 7 ngày (API usage)</h2>
                  <div className="flex items-end gap-2 h-32">
                    {(() => {
                      const max = Math.max(...analytics.weekRevenue.map(d => d.revenue), 0.0001);
                      return analytics.weekRevenue.map(d => (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-gray-600 text-[9px]">${d.revenue.toFixed(4)}</span>
                          <div className="w-full bg-purple-700/60 rounded-t"
                            style={{ height: `${Math.max(4, (d.revenue / max) * 100)}px` }} />
                          <span className="text-gray-600 text-[9px]">{d.date.slice(5)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Top models */}
                {analytics.topModels.length > 0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h2 className="text-white font-semibold mb-4">Top models (theo chi phí)</h2>
                    <div className="space-y-3">
                      {analytics.topModels.map((m) => {
                        const maxCost = analytics.topModels[0].cost || 1;
                        return (
                          <div key={m.model}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-300 font-mono">{m.model}</span>
                              <span className="text-purple-400">${m.cost.toFixed(6)}</span>
                            </div>
                            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full bg-purple-600 rounded-full" style={{ width: `${(m.cost / maxCost) * 100}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "stats" && stats && (
          <div>
            <h1 className="text-2xl font-bold text-white mb-6">{t.admin.overview}</h1>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-gray-900 border border-purple-800/50 rounded-xl p-5">
                <p className="text-xs text-purple-400 uppercase tracking-wider mb-2">{t.admin.totalUsers}</p>
                <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
              </div>
              <div className="bg-gray-900 border border-cyan-800/50 rounded-xl p-5">
                <p className="text-xs text-cyan-400 uppercase tracking-wider mb-2">{t.admin.activeKeys}</p>
                <p className="text-2xl font-bold text-white">{stats.activeKeys}</p>
              </div>
              <div className="bg-gray-900 border border-green-800/50 rounded-xl p-5">
                <p className="text-xs text-green-400 uppercase tracking-wider mb-2">{t.admin.totalRevenue}</p>
                <p className="text-2xl font-bold text-white">${stats.totalRevenue.toFixed(4)}</p>
              </div>
              <div className="bg-gray-900 border border-yellow-800/50 rounded-xl p-5">
                <p className="text-xs text-yellow-400 uppercase tracking-wider mb-2">{t.admin.pendingTopups}</p>
                <p className="text-2xl font-bold text-white">{stats.pendingTopups}</p>
                {stats.pendingTopups > 0 && (
                  <button onClick={() => setTab("topups")} className="text-xs text-yellow-400 mt-1">Review →</button>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "users" && (
          <div>
            <h1 className="text-2xl font-bold text-white mb-6">{t.admin.users.title}</h1>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12"><div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                      <th className="px-4 py-3 text-left">{t.admin.users.email}</th>
                      <th className="px-4 py-3 text-right">{t.admin.users.balance}</th>
                      <th className="px-4 py-3 text-right">Gói / Hết hạn</th>
                      <th className="px-4 py-3 text-right">Keys / Reqs</th>
                      <th className="px-4 py-3 text-left">Trạng thái</th>
                      <th className="px-4 py-3 text-left">{t.admin.users.joined}</th>
                      <th className="px-4 py-3 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {users.map((u) => (
                      <tr key={u.id} className={`hover:bg-gray-800/30 ${u.banned ? "opacity-60" : ""}`}>
                        <td className="px-4 py-3">
                          <p className="text-gray-200 text-xs font-medium">{u.email}</p>
                          <p className="text-gray-500 text-[10px]">{u.name || ""}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-mono">
                          <span className="text-green-400">{u.balance.toFixed(4)} cr</span>
                          {u.redeemBalance > 0 && (
                            <span className={`block text-[10px] ${u.redeemExpiresAt && new Date(u.redeemExpiresAt) < new Date() ? "text-red-500" : "text-amber-400"}`}>
                              +{u.redeemBalance.toFixed(4)} đổi thưởng
                              {u.redeemExpiresAt && <span className="block text-gray-500">HSD {new Date(u.redeemExpiresAt).toLocaleDateString("vi-VN")}</span>}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-xs">
                          {u.dailyLimit > 0 ? (
                            <span className={`font-mono ${u.planExpiresAt && new Date(u.planExpiresAt) < new Date() ? "text-red-400" : "text-teal-400"}`}>
                              {u.dailyLimit.toFixed(2)} cr/ngày
                              {u.planExpiresAt && <span className="block text-gray-500 text-[10px]">{new Date(u.planExpiresAt).toLocaleDateString("vi-VN")}</span>}
                            </span>
                          ) : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400 text-xs">{u._count.apiKeys} / {u._count.usageLogs}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-purple-900/40 text-purple-400" : "bg-gray-800 text-gray-400"}`}>
                              {u.role}
                            </span>
                            {u.banned && <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-800/40">Bị khóa</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.createdAt).toLocaleDateString("vi-VN")}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => { setUserModal({ type: "add_balance", user: u }); setModalInput(""); setModalNote(""); }}
                              className="text-[11px] px-2 py-1 rounded bg-green-900/30 text-green-400 hover:bg-green-900/60 border border-green-800/40 transition-colors"
                              title="Nạp tiền thủ công"
                            >💳 Nạp</button>
                            <button
                              onClick={() => { setUserModal({ type: "change_password", user: u }); setModalInput(""); }}
                              className="text-[11px] px-2 py-1 rounded bg-blue-900/30 text-blue-400 hover:bg-blue-900/60 border border-blue-800/40 transition-colors"
                              title="Đổi mật khẩu"
                            >🔑 MK</button>
                            {u.role !== "admin" && (
                              <button
                                onClick={() => toggleBan(u)}
                                className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                                  u.banned
                                    ? "bg-teal-900/30 text-teal-400 hover:bg-teal-900/60 border-teal-800/40"
                                    : "bg-red-900/30 text-red-400 hover:bg-red-900/60 border-red-800/40"
                                }`}
                                title={u.banned ? "Mở khóa" : "Khóa tài khoản"}
                              >{u.banned ? "✓ Mở" : "🚫 Ban"}</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === "topups" && (
          <div>
            <h1 className="text-2xl font-bold text-white mb-6">{t.admin.topups.title}</h1>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-12"><div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                      <th className="px-5 py-3 text-left">{t.admin.topups.user}</th>
                      <th className="px-5 py-3 text-left">{t.admin.topups.method}</th>
                      <th className="px-5 py-3 text-right">{t.admin.topups.amount}</th>
                      <th className="px-5 py-3 text-left">{t.admin.topups.note}</th>
                      <th className="px-5 py-3 text-left">{t.admin.tcdmx.status}</th>
                      <th className="px-5 py-3 text-left">{t.admin.topups.date}</th>
                      <th className="px-5 py-3 text-right">{t.keys.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-800/30">
                        <td className="px-5 py-3 text-gray-300 text-xs">{tx.user.email}</td>
                        <td className="px-5 py-3 text-gray-400 text-xs">{tx.method}</td>
                        <td className="px-5 py-3 text-right text-white font-medium text-xs">${tx.amount.toFixed(4)}</td>
                        <td className="px-5 py-3 text-gray-500 text-xs max-w-xs truncate">{tx.note || "-"}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            tx.status === "pending" ? "bg-yellow-900/30 text-yellow-400 border-yellow-800/50" :
                            tx.status === "completed" ? "bg-green-900/30 text-green-400 border-green-800/50" :
                            "bg-red-900/30 text-red-400 border-red-800/50"
                          }`}>{tx.status}</span>
                        </td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{new Date(tx.createdAt).toLocaleDateString("vi-VN")}</td>
                        <td className="px-5 py-3 text-right">
                          {tx.status === "pending" && (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => approveTopup(tx.id)} className="text-xs bg-green-900/40 text-green-400 hover:bg-green-900 px-3 py-1.5 rounded-lg border border-green-800/50">
                                {t.admin.topups.approve}
                              </button>
                              <button onClick={() => rejectTopup(tx.id)} className="text-xs bg-red-900/40 text-red-400 hover:bg-red-900 px-3 py-1.5 rounded-lg border border-red-800/50">
                                {t.admin.topups.reject}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        {tab === "redeem" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-white">{t.admin.redeem.title}</h1>
              <button onClick={cleanupExpiredCodes}
                className="text-xs border border-red-800/40 text-red-400 hover:bg-red-900/20 px-3 py-2 rounded-lg transition-colors">
                🗑 Xóa mã hết hạn chưa dùng
              </button>
            </div>

            {/* Default credit expiry setting */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
              <h3 className="font-medium text-white mb-2">Cấu hình credit từ mã đổi thưởng</h3>
              <p className="text-gray-500 text-xs mb-3">Số ngày credit còn dùng được sau khi user đổi mã (áp cho lần đổi mới nhất). Đặt &quot;0&quot; = vĩnh viễn.</p>
              <div className="flex items-end gap-3">
                <div className="flex-1 max-w-xs">
                  <label className="text-gray-500 text-xs block mb-1">Hạn dùng credit sau khi đổi (ngày)</label>
                  <input type="number" min="0"
                    value={settings.redeem_default_days ?? "30"}
                    onChange={e => setSettings(s => ({ ...s, redeem_default_days: e.target.value }))}
                    placeholder="30"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" />
                </div>
                <button
                  onClick={async () => {
                    await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "save_settings", settings: { redeem_default_days: settings.redeem_default_days || "30" } }) });
                    alert("Đã lưu");
                  }}
                  className="bg-purple-700 hover:bg-purple-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium">
                  Lưu
                </button>
              </div>
            </div>

            {/* Create codes form */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
              <h3 className="font-medium text-white mb-4">{t.admin.redeem.createNew}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
                <div>
                  <label className="text-gray-500 text-xs block mb-1">Credit</label>
                  <input type="number" value={newCodeAmount} onChange={(e) => setNewCodeAmount(e.target.value)}
                    placeholder="VD: 10.00" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-gray-500 text-xs block mb-1">Số lượng</label>
                  <input type="number" value={newCodeCount} onChange={(e) => setNewCodeCount(e.target.value)}
                    placeholder="1" min="1" max="100" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-gray-500 text-xs block mb-1" title="Sau bao nhiêu ngày kể từ giờ thì mã không còn đổi được nữa">Hạn mã (ngày)</label>
                  <input type="number" value={newCodeExpireDays} onChange={(e) => setNewCodeExpireDays(e.target.value)}
                    placeholder="VD: 30 (trống = vĩnh viễn)" min="1"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-gray-500 text-xs block mb-1" title="Credit sau khi đổi tồn tại bao nhiêu ngày trước khi hết hạn">Hạn credit (ngày)</label>
                  <input type="number" value={newCodeCreditDays} onChange={(e) => setNewCodeCreditDays(e.target.value)}
                    placeholder="VD: 1 (trống = mặc định)" min="1"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" />
                </div>
                <div className="sm:col-span-1 lg:col-span-2">
                  <label className="text-gray-500 text-xs block mb-1">Ghi chú</label>
                  <input type="text" value={newCodeNote} onChange={(e) => setNewCodeNote(e.target.value)}
                    placeholder={t.admin.redeem.note}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" />
                </div>
              </div>
              <button onClick={createRedeemCodes} disabled={creatingCode || !newCodeAmount}
                className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium">
                {creatingCode ? t.admin.redeem.generating : t.admin.redeem.generate}
              </button>

              {createdCodes.length > 0 && (
                <div className="mt-4 bg-gray-800 rounded-lg p-4">
                  <p className="text-green-400 text-xs font-medium mb-2">✓ Đã tạo {createdCodes.length} mã:</p>
                  <div className="space-y-1">
                    {createdCodes.map((c) => (
                      <p key={c} className="text-white font-mono text-sm tracking-wider">{c}</p>
                    ))}
                  </div>
                  <button onClick={() => setCreatedCodes([])} className="text-gray-500 text-xs mt-2 hover:text-gray-300">Đóng</button>
                </div>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-12"><div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : redeemCodes.length === 0 ? (
                <div className="text-center py-12 text-gray-600 text-sm">Chưa có mã nào</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                      <th className="px-5 py-3 text-left">{t.admin.redeem.code}</th>
                      <th className="px-5 py-3 text-right">Credit</th>
                      <th className="px-5 py-3 text-left">Ghi chú</th>
                      <th className="px-5 py-3 text-left">Hạn dùng</th>
                      <th className="px-5 py-3 text-left">Trạng thái</th>
                      <th className="px-5 py-3 text-right">{t.keys.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {redeemCodes.map((c) => {
                      const expired = !c.usedBy && c.expiresAt && new Date(c.expiresAt) < new Date();
                      return (
                        <tr key={c.id} className={`hover:bg-gray-800/30 ${expired ? "opacity-50" : ""}`}>
                          <td className="px-5 py-3 font-mono text-xs text-white tracking-wider">{c.code}</td>
                          <td className="px-5 py-3 text-right text-green-400 text-xs font-medium">{c.amount.toFixed(2)} cr</td>
                          <td className="px-5 py-3 text-gray-500 text-xs">{c.note || "-"}</td>
                          <td className="px-5 py-3 text-xs">
                            {c.expiresAt ? (
                              <span className={expired ? "text-red-400" : "text-yellow-400"}>
                                {new Date(c.expiresAt).toLocaleDateString("vi-VN")}
                                {expired && " ⚠ Hết hạn"}
                              </span>
                            ) : (
                              <span className="text-gray-600">Vĩnh viễn</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {c.usedBy ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">
                                Đã dùng {c.usedAt ? new Date(c.usedAt).toLocaleDateString("vi-VN") : ""}
                              </span>
                            ) : expired ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/30 text-red-400 border border-red-800/50">Hết hạn</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-800/50">{t.admin.redeem.unused}</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {!c.usedBy && (
                              <button onClick={() => deleteRedeemCode(c.id)}
                                className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-800/40 hover:bg-red-900/20">
                                Xóa
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        {tab === "tcdmx" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">{t.admin.tcdmx.title}</h1>
              </div>
              <button onClick={runReconcile} disabled={reconciling}
                className="bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                {reconciling ? "Đang kiểm tra..." : "🔄 Reconcile với TCDMX"}
              </button>
            </div>

            {/* Reconcile panel */}
            {reconcile && (
              <div className="bg-gray-900 border border-teal-800/40 rounded-xl p-5 mb-6">
                <h3 className="text-white font-medium mb-3">📊 Đối soát với TCDMX</h3>
                {reconcile.error ? (
                  <p className="text-red-400 text-sm">{reconcile.error}</p>
                ) : (
                  <>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">Quota TCDMX còn lại</p>
                        <p className="text-2xl font-bold text-white">${reconcile.quota?.remaining?.toFixed(2) ?? "—"}</p>
                        <p className="text-xs text-gray-600">/ ${reconcile.quota?.limit?.toFixed(0) ?? "—"} {reconcile.quota?.unit}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">User trả mình</p>
                        <p className="text-2xl font-bold text-green-400">${reconcile.myRevenue.toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">TCDMX trừ mình (thật)</p>
                        <p className="text-2xl font-bold text-orange-400">${reconcile.realTcdmxUsed.toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">Lãi hiện tại</p>
                        <p className={`text-2xl font-bold ${reconcile.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>${reconcile.profit.toFixed(4)}</p>
                        <p className="text-xs text-gray-600">{(reconcile.profitMargin * 100).toFixed(1)}% margin</p>
                      </div>
                    </div>
                    <div className="border-t border-gray-800 pt-3">
                      <p className="text-xs text-gray-500 mb-2">
                        Drift (mình tự tính TCDMX cost vs thực tế): <span className={Math.abs(reconcile.drift) > 0.05 ? "text-red-400 font-bold" : "text-gray-400"}>{(reconcile.drift * 100).toFixed(2)}%</span>
                        {Math.abs(reconcile.drift) > 0.05 && <span className="ml-2 text-red-400">⚠ Bảng giá có thể đã lệch — kiểm tra tooltip TCDMX</span>}
                      </p>
                      {reconcile.model_stats && reconcile.model_stats.length > 0 && (
                        <details className="mt-3">
                          <summary className="text-xs text-gray-400 cursor-pointer">Chi tiết theo model ({reconcile.model_stats.length})</summary>
                          <table className="w-full text-xs mt-2">
                            <thead><tr className="text-gray-500"><th className="text-left py-1">Model</th><th className="text-right">Requests</th><th className="text-right">TCDMX cost</th><th className="text-right">Giá thị trường</th></tr></thead>
                            <tbody>
                              {reconcile.model_stats.map(m => (
                                <tr key={m.model} className="text-gray-300"><td className="font-mono py-1">{m.model}</td><td className="text-right">{m.requests}</td><td className="text-right text-orange-400">${m.cost.toFixed(4)}</td><td className="text-right text-gray-500">${m.actual_cost.toFixed(4)}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </details>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Status summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: t.admin.tcdmx.totalKeys, value: tcdmxKeys.length, color: "purple" },
                { label: t.admin.tcdmx.activeKeys, value: tcdmxKeys.filter(k => k.status === "active").length, color: "green" },
                { label: t.admin.tcdmx.errorKeys, value: tcdmxKeys.filter(k => k.status !== "active").length, color: "red" },
              ].map(s => (
                <div key={s.label} className={`bg-gray-900 border border-${s.color}-800/40 rounded-xl p-4`}>
                  <p className={`text-xs text-${s.color}-400 uppercase tracking-wider mb-1`}>{s.label}</p>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Add key form */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5">
              <h3 className="text-white font-medium mb-4">{t.admin.tcdmx.addKey}</h3>
              <div className="flex gap-3">
                <select value={newTcdmxKey.provider} onChange={e => setNewTcdmxKey(p => ({ ...p, provider: e.target.value }))}
                  className="w-36 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:border-purple-500">
                  {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <input type="text" value={newTcdmxKey.key} onChange={e => setNewTcdmxKey(p => ({ ...p, key: e.target.value }))}
                  placeholder="sk-xxxxxxxx... (full key)"
                  className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm font-mono focus:border-purple-500" />
                <input type="text" value={newTcdmxKey.label} onChange={e => setNewTcdmxKey(p => ({ ...p, label: e.target.value }))}
                  placeholder="Label (optional)"
                  className="w-40 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:border-purple-500" />
                <button onClick={addTcdmxKey} disabled={addingKey || !newTcdmxKey.key.trim()}
                  className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium">
                  {addingKey ? t.admin.tcdmx.adding : t.admin.tcdmx.add}
                </button>
              </div>
              <p className="text-gray-600 text-xs mt-2">Key sẽ được lưu bảo mật. Chỉ hiển thị 8 ký tự đầu và 6 ký tự cuối.</p>
            </div>

            {/* Keys table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {loading ? (
                <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : tcdmxKeys.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-3xl mb-3">🔑</p>
                  <p className="text-gray-400 text-sm">Chưa có key nào. Thêm TCDMX API key để bắt đầu.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                      <th className="px-5 py-3 text-left">{t.admin.tcdmx.provider}</th>
                      <th className="px-5 py-3 text-left">{t.admin.tcdmx.label}</th>
                      <th className="px-5 py-3 text-left">{t.admin.tcdmx.key}</th>
                      <th className="px-5 py-3 text-center">{t.admin.tcdmx.status}</th>
                      <th className="px-5 py-3 text-center">{t.admin.tcdmx.errors}</th>
                      <th className="px-5 py-3 text-left">{t.admin.tcdmx.lastUsed}</th>
                      <th className="px-5 py-3 text-left">{t.admin.redeem.created}</th>
                      <th className="px-5 py-3 text-right">{t.admin.tcdmx.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {tcdmxKeys.map(k => (
                      <tr key={k.id} className="hover:bg-gray-800/30">
                        <td className="px-5 py-3 text-sm">
                          {(() => {
                            const p = PROVIDERS.find(p => p.value === k.provider);
                            const label = p?.label || k.provider;
                            const badge = p?.badge || "bg-gray-800 text-gray-400 border-gray-700";
                            return <span className={`text-xs px-2 py-1 rounded border font-medium ${badge}`}>{label}</span>;
                          })()}
                        </td>
                        <td className="px-5 py-3 text-gray-300 text-sm">{k.label || <span className="text-gray-600 italic">no label</span>}</td>
                        <td className="px-5 py-3 font-mono text-xs text-teal-400">{k.key}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                            k.status === "active" ? "bg-green-900/30 text-green-400 border-green-800/50" : "bg-red-900/30 text-red-400 border-red-800/50"
                          }`}>
                            {k.status === "active" ? `● ${t.admin.tcdmx.active}` : `● ${t.admin.tcdmx.disabled}`}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`text-xs font-mono font-bold ${k.errorCount > 0 ? "text-red-400" : "text-gray-500"}`}>
                            {k.errorCount}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-500 text-xs">
                          {k.lastUsed ? new Date(k.lastUsed).toLocaleString("vi-VN") : "-"}
                        </td>
                        <td className="px-5 py-3 text-gray-500 text-xs">
                          {new Date(k.createdAt).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {k.errorCount > 0 && (
                              <button onClick={() => resetTcdmxKeyErrors(k.id)}
                                className="text-xs text-yellow-400 hover:text-yellow-300 px-2 py-1 rounded border border-yellow-800/40">
                                {t.admin.tcdmx.reset}
                              </button>
                            )}
                            <button onClick={() => toggleTcdmxKey(k.id)}
                              className={`text-xs px-2 py-1 rounded border ${k.status === "active" ? "text-gray-400 border-gray-700 hover:text-white" : "text-green-400 border-green-800/40 hover:text-green-300"}`}>
                              {k.status === "active" ? t.admin.tcdmx.disable : t.admin.tcdmx.enable}
                            </button>
                            <button onClick={() => deleteTcdmxKey(k.id)}
                              className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-800/40">
                              {t.common.delete}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* How it works */}
            <div className="mt-5 bg-gray-900 border border-purple-800/30 rounded-xl p-5">
              <p className="text-purple-400 font-medium mb-3">⚙ Cơ chế hoạt động</p>
              <ul className="space-y-1.5 text-sm text-gray-400">
                {[
                  "Mỗi request sẽ chọn ngẫu nhiên 1 key active từ pool",
                  "Nếu key bị 429 (rate limit) → tự động thử key tiếp theo",
                  "Nếu key bị 401 (invalid) → tự động disable key đó",
                  "Key bị rate limit sẽ được hồi phục sau 60 giây",
                  "Nếu tất cả key đều bị rate limit → trả lỗi 429 cho client",
                  "Fallback về TCDMX_API_KEY trong .env nếu chưa có key nào trong DB",
                ].map(t => (
                  <li key={t} className="flex items-start gap-2"><span className="text-purple-400 mt-0.5">•</span>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {tab === "pricing" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-white">{t.admin.pricing.title}</h1>
              <button onClick={savePricing} disabled={savingPricing} className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium">
                {savingPricing ? t.common.loading : t.admin.pricing.saveAll}
              </button>
            </div>

            {/* Global settings */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5">
              <h3 className="text-white font-medium mb-4">{t.admin.pricing.globalSettings}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">{t.admin.pricing.markup}</label>
                  <input type="number" step="0.01" min="1" value={settings.price_markup || "1.3"}
                    onChange={e => setSettings(s => ({ ...s, price_markup: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">{t.admin.pricing.concurrency}</label>
                  <input type="number" min="1" value={settings.default_concurrency || "5"}
                    onChange={e => setSettings(s => ({ ...s, default_concurrency: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" />
                </div>
              </div>
            </div>

            {/* Pricing audit vs TCDMX */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-white font-medium">Audit giá vs TCDMX</h3>
                  <p className="text-xs text-gray-500 mt-1">So sánh giá DB với cost thực tế từ TCDMX /v1/usage. Highlight model lệch &gt;10%.</p>
                </div>
                <button onClick={runPricingAudit} disabled={auditLoading}
                  className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {auditLoading ? "Đang kiểm tra..." : "Chạy audit"}
                </button>
              </div>
              {auditError && <div className="text-red-400 text-xs">Error: {auditError}</div>}
              {pricingAudit && (
                <div className="overflow-x-auto">
                  <div className="text-xs text-gray-500 mb-2">Fetched: {new Date(pricingAudit.fetchedAt).toLocaleString()}</div>
                  <table className="min-w-full text-xs">
                    <thead className="text-gray-400 border-b border-gray-800">
                      <tr>
                        <th className="text-left px-2 py-2">Model</th>
                        <th className="text-right px-2 py-2">In tok</th>
                        <th className="text-right px-2 py-2">Out tok</th>
                        <th className="text-right px-2 py-2">Actual cost</th>
                        <th className="text-right px-2 py-2">Actual $/1M</th>
                        <th className="text-right px-2 py-2">DB $/1M</th>
                        <th className="text-right px-2 py-2">Lệch %</th>
                        <th className="text-left px-2 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pricingAudit.audit.map((a, i) => (
                        <tr key={i} className={`border-b border-gray-800 ${a.status === "diverged" ? "bg-red-900/20" : a.status === "no_db_pricing" ? "bg-yellow-900/20" : ""}`}>
                          <td className="px-2 py-2 text-white">{a.model}</td>
                          <td className="px-2 py-2 text-right text-gray-300">{a.inputTokens.toLocaleString()}</td>
                          <td className="px-2 py-2 text-right text-gray-300">{a.outputTokens.toLocaleString()}</td>
                          <td className="px-2 py-2 text-right text-gray-300">${a.actualCost.toFixed(4)}</td>
                          <td className="px-2 py-2 text-right text-gray-300">${a.actualPerMTokens.toFixed(3)}</td>
                          <td className="px-2 py-2 text-right text-gray-300">{a.dbBlendedPerMTokens !== null ? `$${a.dbBlendedPerMTokens.toFixed(3)}` : "—"}</td>
                          <td className={`px-2 py-2 text-right font-medium ${a.divergencePct === null ? "text-gray-500" : Math.abs(a.divergencePct) > 10 ? "text-red-400" : "text-green-400"}`}>{a.divergencePct !== null ? `${a.divergencePct > 0 ? "+" : ""}${a.divergencePct.toFixed(1)}%` : "—"}</td>
                          <td className="px-2 py-2 text-gray-400">{a.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {pricingAudit.audit.length === 0 && <div className="text-gray-500 text-xs py-4 text-center">Không có dữ liệu usage từ TCDMX.</div>}
                </div>
              )}
            </div>

            {/* Add new model */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5">
              <h3 className="text-white font-medium mb-3">{t.admin.pricing.addModel}</h3>
              <p className="text-xs text-gray-500 mb-3">Nhập giá TCDMX gốc từ tooltip dashboard (Input price, Output price, Service tier). Markup là biên lợi nhuận của bạn.</p>
              <div className="flex gap-2 flex-wrap">
                <input type="text" value={newModel.model} onChange={e => setNewModel(p => ({ ...p, model: e.target.value }))}
                  placeholder="Model ID (gpt-5.4-mini)" className="flex-1 min-w-[180px] bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" />
                <input type="number" step="0.001" value={newModel.tcdmxInputPrice} onChange={e => setNewModel(p => ({ ...p, tcdmxInputPrice: e.target.value }))}
                  placeholder="TCDMX Input $/1M" className="w-32 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" />
                <input type="number" step="0.001" value={newModel.tcdmxOutputPrice} onChange={e => setNewModel(p => ({ ...p, tcdmxOutputPrice: e.target.value }))}
                  placeholder="TCDMX Output $/1M" className="w-32 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" />
                <input type="number" step="0.001" value={newModel.tcdmxCachePrice} onChange={e => setNewModel(p => ({ ...p, tcdmxCachePrice: e.target.value }))}
                  placeholder="TCDMX Cache $/1M" className="w-32 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" title="Cache read price per 1M tokens. Leave 0 to default to 10% of input price." />
                <input type="number" step="0.1" value={newModel.tcdmxTier} onChange={e => setNewModel(p => ({ ...p, tcdmxTier: e.target.value }))}
                  placeholder="Tier" className="w-20 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" title="Service tier multiplier (Standard=2.0)" />
                <input type="number" step="0.05" value={newModel.markup} onChange={e => setNewModel(p => ({ ...p, markup: e.target.value }))}
                  placeholder="Markup" className="w-20 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" title="Profit markup (1.3 = +30%)" />
                <input type="number" step="0.001" value={newModel.flatCostPerCall} onChange={e => setNewModel(p => ({ ...p, flatCostPerCall: e.target.value }))}
                  placeholder="Flat $/call" className="w-28 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" title="Optional: flat TCDMX cost per call (overrides token pricing). For image models like gpt-image-2 ($0.268/call)." />
                <button onClick={addNewModel} className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium">{t.common.add}</button>
              </div>
            </div>

            {/* Model list */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {loading ? <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div> : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                      <th className="px-3 py-3 text-left">Model</th>
                      <th className="px-2 py-3 text-right" title="Giá TCDMX trừ mình">TCDMX In</th>
                      <th className="px-2 py-3 text-right">TCDMX Out</th>
                      <th className="px-2 py-3 text-right" title="Giá cache (mặc định 10% input nếu để 0)">Cache</th>
                      <th className="px-2 py-3 text-center">Tier</th>
                      <th className="px-2 py-3 text-center">Markup</th>
                      <th className="px-2 py-3 text-right" title="Flat $/call (override token pricing). Dùng cho image models. Để trống = tính theo token.">Flat $</th>
                      <th className="px-2 py-3 text-right" title="User trả">User In</th>
                      <th className="px-2 py-3 text-right">User Out</th>
                      <th className="px-2 py-3 text-center">On</th>
                      <th className="px-2 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {modelPricing.map(p => {
                      const e = editingPricing[p.id] || { tcdmxInputPrice: String(p.tcdmxInputPrice ?? 0), tcdmxOutputPrice: String(p.tcdmxOutputPrice ?? 0), tcdmxCachePrice: String(p.tcdmxCachePrice ?? 0), tcdmxTier: String(p.tcdmxTier ?? 2.0), markup: String(p.markup ?? 1.3), flatCostPerCall: p.flatCostPerCall != null ? String(p.flatCostPerCall) : "", enabled: p.enabled };
                      const tier = parseFloat(e.tcdmxTier) || 0;
                      const mk = parseFloat(e.markup) || 0;
                      const flat = parseFloat(e.flatCostPerCall) || 0;
                      const userIn = flat > 0 ? flat * mk : (parseFloat(e.tcdmxInputPrice) || 0) * tier * mk;
                      const userOut = flat > 0 ? flat * mk : (parseFloat(e.tcdmxOutputPrice) || 0) * tier * mk;
                      return (
                        <tr key={p.id} className="hover:bg-gray-800/30">
                          <td className="px-3 py-2 text-white font-mono text-xs">{p.model}</td>
                          <td className="px-2 py-2"><input type="number" step="0.001" value={e.tcdmxInputPrice} onChange={ev => setEditingPricing(prev => ({ ...prev, [p.id]: { ...e, tcdmxInputPrice: ev.target.value } }))} className="w-20 bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 text-xs" /></td>
                          <td className="px-2 py-2"><input type="number" step="0.001" value={e.tcdmxOutputPrice} onChange={ev => setEditingPricing(prev => ({ ...prev, [p.id]: { ...e, tcdmxOutputPrice: ev.target.value } }))} className="w-20 bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 text-xs" /></td>
                          <td className="px-2 py-2"><input type="number" step="0.001" value={e.tcdmxCachePrice} onChange={ev => setEditingPricing(prev => ({ ...prev, [p.id]: { ...e, tcdmxCachePrice: ev.target.value } }))} className="w-20 bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 text-xs" title="Cache read price (0 = auto 10% input)" /></td>
                          <td className="px-2 py-2 text-center"><input type="number" step="0.1" value={e.tcdmxTier} onChange={ev => setEditingPricing(prev => ({ ...prev, [p.id]: { ...e, tcdmxTier: ev.target.value } }))} className="w-14 bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 text-xs text-center" /></td>
                          <td className="px-2 py-2 text-center"><input type="number" step="0.05" value={e.markup} onChange={ev => setEditingPricing(prev => ({ ...prev, [p.id]: { ...e, markup: ev.target.value } }))} className="w-14 bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 text-xs text-center" /></td>
                          <td className="px-2 py-2"><input type="number" step="0.001" value={e.flatCostPerCall} onChange={ev => setEditingPricing(prev => ({ ...prev, [p.id]: { ...e, flatCostPerCall: ev.target.value } }))} className="w-20 bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 text-xs" placeholder="—" title="Flat $/call (overrides token pricing)" /></td>
                          <td className="px-2 py-2 text-right text-green-400 text-xs font-mono">{userIn.toFixed(3)}</td>
                          <td className="px-2 py-2 text-right text-green-400 text-xs font-mono">{userOut.toFixed(3)}</td>
                          <td className="px-2 py-2 text-center"><input type="checkbox" checked={e.enabled} onChange={ev => setEditingPricing(prev => ({ ...prev, [p.id]: { ...e, enabled: ev.target.checked } }))} className="accent-purple-600" /></td>
                          <td className="px-2 py-2 text-right"><button onClick={() => deletePricingRow(p.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-800/40">Del</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === "plans" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-white">{t.admin.plans.title}</h1>
              <button onClick={() => setEditPlan({ name: "", price: 0, duration: 30, description: "", featuresText: "", enabled: true, sortOrder: plans.length })}
                className="bg-purple-700 hover:bg-purple-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium">
                + {t.admin.plans.addPlan}
              </button>
            </div>

            {/* Credit rate */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5">
              <h3 className="text-white font-medium mb-1 flex items-center gap-2">💱 Tỷ giá Credit</h3>
              <p className="text-gray-500 text-xs mb-4">Quy đổi 1 credit (USD) = ? VND. Áp dụng khi user nạp tiền và mua gói. 0 = ẩn quy đổi VND.</p>
              <div className="flex items-end gap-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">1 credit = ? VND</label>
                  <input
                    type="number"
                    min="0"
                    value={paymentSettings.usd_to_vnd || ""}
                    onChange={e => setPaymentSettings(p => ({ ...p, usd_to_vnd: e.target.value }))}
                    placeholder="VD: 25000"
                    className="w-40 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:border-purple-500"
                  />
                </div>
                <button onClick={saveCreditRate}
                  className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium">
                  Lưu tỷ giá
                </button>
                {paymentSaved && <span className="text-teal-400 text-sm">✓ Đã lưu</span>}
              </div>
            </div>

            {/* Edit form */}
            {editPlan && (
              <div className="bg-gray-900 border border-purple-800/50 rounded-xl p-5 mb-5">
                <h3 className="text-white font-medium mb-4">{editPlan.id ? t.admin.plans.editPlan : t.admin.plans.addPlan}</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">{t.admin.plans.planName}</label>
                    <input value={editPlan.name || ""} onChange={e => setEditPlan(p => ({ ...p!, name: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">{t.admin.plans.price}</label>
                    <input type="number" step="1000" value={editPlan.price || 0} onChange={e => setEditPlan(p => ({ ...p!, price: parseFloat(e.target.value) }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">{t.admin.plans.duration}</label>
                    <input type="number" value={editPlan.duration || 30} onChange={e => setEditPlan(p => ({ ...p!, duration: parseInt(e.target.value) }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">{t.admin.plans.dailyLimit}</label>
                    <input type="number" step="0.01" min="0" value={editPlan.dailyLimit ?? 0} onChange={e => setEditPlan(p => ({ ...p!, dailyLimit: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" />
                    <p className="text-gray-600 text-xs mt-1">credit/ngày. 0 = không giới hạn</p>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">{t.admin.plans.sortOrder}</label>
                    <input type="number" value={editPlan.sortOrder || 0} onChange={e => setEditPlan(p => ({ ...p!, sortOrder: parseInt(e.target.value) }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Luồng đồng thời</label>
                    <input type="number" min="1" value={editPlan.concurrencyLimit ?? 5} onChange={e => setEditPlan(p => ({ ...p!, concurrencyLimit: parseInt(e.target.value) || 1 }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" />
                    <p className="text-gray-600 text-xs mt-1">request đồng thời tối đa per-user</p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-gray-400 text-xs mb-1">{t.admin.plans.description}</label>
                    <input value={editPlan.description || ""} onChange={e => setEditPlan(p => ({ ...p!, description: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-gray-400 text-xs mb-1">{t.admin.plans.features}</label>
                    <textarea rows={4} value={editPlan.featuresText || (editPlan.features ? JSON.parse(editPlan.features).join("\n") : "")}
                      onChange={e => setEditPlan(p => ({ ...p!, featuresText: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm resize-none" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="plan-enabled" checked={editPlan.enabled !== false}
                      onChange={e => setEditPlan(p => ({ ...p!, enabled: e.target.checked }))} className="accent-purple-600" />
                    <label htmlFor="plan-enabled" className="text-gray-400 text-sm">{t.admin.plans.enabledLabel}</label>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={savePlan} disabled={savingPlan} className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium">
                    {savingPlan ? t.admin.plans.saving : t.admin.plans.save}
                  </button>
                  <button onClick={() => setEditPlan(null)} className="border border-gray-700 text-gray-400 px-5 py-2 rounded-lg text-sm">{t.admin.plans.cancel}</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {loading ? <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div> :
                plans.length === 0 ? <div className="text-center py-12 text-gray-600 text-sm">{t.admin.plans.noPlans}</div> :
                plans.map(plan => (
                  <div key={plan.id} className={`bg-gray-900 border ${plan.enabled ? "border-gray-800" : "border-gray-800/40 opacity-60"} rounded-xl p-5 flex items-start justify-between gap-4`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="text-white font-semibold">{plan.name}</p>
                        <span className="text-xs bg-purple-900/40 text-purple-400 border border-purple-800/50 px-2 py-0.5 rounded">
                          {plan.price.toLocaleString("vi-VN")}₫/{plan.duration}ngày
                        </span>
                        {plan.dailyLimit > 0 && (
                          <span className="text-xs bg-teal-900/40 text-teal-400 border border-teal-800/50 px-2 py-0.5 rounded">
                            {plan.dailyLimit.toFixed(2)} credit/ngày
                          </span>
                        )}
                        {!plan.enabled && <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded">Disabled</span>}
                      </div>
                      <p className="text-gray-500 text-sm mb-2">{plan.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {(JSON.parse(plan.features) as string[]).map(f => (
                          <span key={f} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{f}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => setEditPlan({ ...plan, featuresText: JSON.parse(plan.features).join("\n") })}
                        className="text-xs border border-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg">{t.admin.plans.edit}</button>
                      <button onClick={() => deletePlan(plan.id)}
                        className="text-xs border border-red-800/40 text-red-400 hover:bg-red-900/20 px-3 py-1.5 rounded-lg">{t.admin.plans.del}</button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {tab === "payment" && (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">{t.admin.payment.title}</h1>
                <p className="text-gray-400 text-sm mt-1">{t.admin.payment.subtitle}</p>
              </div>
              <button
                onClick={savePaymentConfig}
                disabled={savingPayment}
                className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2"
              >
                {paymentSaved ? "✓ " + t.admin.payment.saved : savingPayment ? t.admin.payment.saving : t.admin.payment.save}
              </button>
            </div>

            {/* Bank Transfer */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">🏦 {t.admin.payment.bankSection}</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">{t.admin.payment.bankName}</label>
                  <input
                    value={paymentSettings.bank_name}
                    onChange={e => setPaymentSettings(p => ({ ...p, bank_name: e.target.value }))}
                    placeholder="e.g. Vietcombank, BIDV, MBBank..."
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">{t.admin.payment.bankAccount}</label>
                  <input
                    value={paymentSettings.bank_account}
                    onChange={e => setPaymentSettings(p => ({ ...p, bank_account: e.target.value }))}
                    placeholder="e.g. 1234567890"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:border-purple-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">{t.admin.payment.bankHolder}</label>
                  <input
                    value={paymentSettings.bank_holder}
                    onChange={e => setPaymentSettings(p => ({ ...p, bank_holder: e.target.value }))}
                    placeholder="e.g. NGUYEN VAN A"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">{t.admin.payment.bankContent}</label>
                  <input
                    value={paymentSettings.bank_content}
                    onChange={e => setPaymentSettings(p => ({ ...p, bank_content: e.target.value }))}
                    placeholder="e.g. NAPTIEN"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:border-purple-500 font-mono"
                  />
                  <p className="text-gray-600 text-xs mt-1">{t.admin.payment.bankContentHint}</p>
                </div>
              </div>
            </div>

            {/* USDT */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">🪙 {t.admin.payment.usdtSection}</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">{t.admin.payment.usdtTrc20}</label>
                  <input
                    value={paymentSettings.usdt_trc20}
                    onChange={e => setPaymentSettings(p => ({ ...p, usdt_trc20: e.target.value }))}
                    placeholder="T..."
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:border-purple-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">{t.admin.payment.usdtErc20}</label>
                  <input
                    value={paymentSettings.usdt_erc20}
                    onChange={e => setPaymentSettings(p => ({ ...p, usdt_erc20: e.target.value }))}
                    placeholder="0x..."
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:border-purple-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">{t.admin.payment.usdtRate}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentSettings.usdt_rate}
                    onChange={e => setPaymentSettings(p => ({ ...p, usdt_rate: e.target.value }))}
                    className="w-32 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:border-purple-500"
                  />
                  <p className="text-gray-600 text-xs mt-1">{t.admin.payment.usdtRateHint}</p>
                </div>
              </div>
            </div>

            {/* Web2M Webhook */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-4">
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium flex items-center gap-2">⚡ Web2M Webhook</h3>
                  <p className="text-gray-500 text-xs mt-0.5">Tự động cộng số dư khi nhận chuyển khoản — real-time, không cần poll</p>
                </div>
                <div
                  onClick={() => setPaymentSettings(p => ({ ...p, web2m_enabled: p.web2m_enabled === "1" ? "0" : "1" }))}
                  className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer flex-shrink-0 ${paymentSettings.web2m_enabled === "1" ? "bg-teal-600" : "bg-gray-700"}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${paymentSettings.web2m_enabled === "1" ? "left-6" : "left-1"}`} />
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Step 1: Access Token */}
                <div>
                  <label className="block text-gray-300 text-xs font-semibold mb-1">
                    Bước 1 — Access Token
                    <span className="text-gray-500 font-normal ml-1">(lấy tại api.web2m.com → Đăng nhập → copy token trong header)</span>
                  </label>
                  <input
                    type="password"
                    value={paymentSettings.web2m_access_token}
                    onChange={e => setPaymentSettings(p => ({ ...p, web2m_access_token: e.target.value }))}
                    placeholder="eyJ0eXAiOiJKV1Qi..."
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm font-mono focus:border-purple-500 focus:outline-none"
                  />
                  <p className="text-gray-600 text-xs mt-1">Web2M gửi token này trong header mỗi webhook — dùng để xác minh request hợp lệ.</p>
                </div>

                {/* Step 2: Webhook URL */}
                <div>
                  <label className="block text-gray-300 text-xs font-semibold mb-1">
                    Bước 2 — Webhook URL
                    <span className="text-gray-500 font-normal ml-1">(copy → dán vào trang Cấu hình Webhook của Web2M)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={typeof window !== "undefined" ? `${window.location.origin}/api/payment/web2m/callback` : "/api/payment/web2m/callback"}
                      className="flex-1 bg-gray-800/50 border border-gray-700 text-teal-400 rounded-lg px-3 py-2.5 text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/payment/web2m/callback`)}
                      className="px-4 py-2 bg-teal-800/40 border border-teal-700/50 text-teal-400 hover:bg-teal-700/50 rounded-lg text-sm font-medium transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-gray-600 text-xs mt-1">Vào api.web2m.com → Cấu hình Webhook → Thêm mới → dán URL trên vào ô Webhook URL.</p>
                </div>

                {/* Bank info for users */}
                <div className="bg-gray-800/50 rounded-xl p-4">
                  <p className="text-white text-xs font-semibold mb-1">Bước 3 — Thông tin ngân hàng hiển thị cho user</p>
                  <p className="text-gray-500 text-xs mb-3">User sẽ thấy thông tin này khi chọn chuyển khoản</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-500 text-xs uppercase tracking-wider mb-1.5">Tên ngân hàng</label>
                      <input value={paymentSettings.bank_name}
                        onChange={e => setPaymentSettings(p => ({ ...p, bank_name: e.target.value }))}
                        placeholder="MB Bank, Vietcombank, ACB..."
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-gray-500 text-xs uppercase tracking-wider mb-1.5">Số tài khoản</label>
                      <input value={paymentSettings.bank_account}
                        onChange={e => setPaymentSettings(p => ({ ...p, bank_account: e.target.value }))}
                        placeholder="0868222252"
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm font-mono focus:border-purple-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-gray-500 text-xs uppercase tracking-wider mb-1.5">Tên chủ tài khoản</label>
                      <input value={paymentSettings.bank_holder}
                        onChange={e => setPaymentSettings(p => ({ ...p, bank_holder: e.target.value }))}
                        placeholder="NGUYEN VAN A"
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-gray-500 text-xs uppercase tracking-wider mb-1.5">BIN ngân hàng (cho VietQR)</label>
                      <input value={paymentSettings.web2m_bank_bin}
                        onChange={e => setPaymentSettings(p => ({ ...p, web2m_bank_bin: e.target.value }))}
                        placeholder="970422"
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm font-mono focus:border-purple-500 focus:outline-none" />
                      <p className="text-gray-600 text-xs mt-1">MB: 970422 · VCB: 970436 · ACB: 970416 · TCB: 970407</p>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-gray-500 text-xs uppercase tracking-wider mb-1.5">Hiển thị mã QR</label>
                      <select value={paymentSettings.web2m_vietqr}
                        onChange={e => setPaymentSettings(p => ({ ...p, web2m_vietqr: e.target.value }))}
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm">
                        <option value="1">✅ Bật — hiện mã VietQR để user quét</option>
                        <option value="0">❌ Tắt</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            {(paymentSettings.bank_name || paymentSettings.usdt_trc20) && (
              <div className="bg-gray-900 border border-purple-800/40 rounded-xl p-5">
                <h3 className="text-purple-400 font-medium mb-3 text-sm">👁 Preview — as users will see it</h3>
                {paymentSettings.bank_name && (
                  <div className="bg-gray-800/60 rounded-lg p-3 text-sm space-y-1.5 mb-3">
                    <div className="flex justify-between"><span className="text-gray-500">Bank:</span><span className="text-white font-medium">{paymentSettings.bank_name}</span></div>
                    {paymentSettings.bank_account && <div className="flex justify-between"><span className="text-gray-500">Account:</span><span className="text-teal-400 font-mono">{paymentSettings.bank_account}</span></div>}
                    {paymentSettings.bank_holder && <div className="flex justify-between"><span className="text-gray-500">Holder:</span><span className="text-white">{paymentSettings.bank_holder}</span></div>}
                    {paymentSettings.bank_content && <div className="flex justify-between"><span className="text-gray-500">Content:</span><span className="text-yellow-400 font-mono text-xs">{paymentSettings.bank_content} [your-email]</span></div>}
                  </div>
                )}
                {(paymentSettings.usdt_trc20 || paymentSettings.usdt_erc20) && (
                  <div className="bg-gray-800/60 rounded-lg p-3 text-sm space-y-1.5">
                    {paymentSettings.usdt_trc20 && <div className="flex justify-between gap-2"><span className="text-gray-500 shrink-0">TRC20:</span><span className="text-teal-400 font-mono text-xs break-all">{paymentSettings.usdt_trc20}</span></div>}
                    {paymentSettings.usdt_erc20 && <div className="flex justify-between gap-2"><span className="text-gray-500 shrink-0">ERC20:</span><span className="text-teal-400 font-mono text-xs break-all">{paymentSettings.usdt_erc20}</span></div>}
                    <div className="flex justify-between"><span className="text-gray-500">Rate:</span><span className="text-white">1 USDT = {paymentSettings.usdt_rate || "1"} USD</span></div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "api" && (
          <div className="max-w-3xl">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white">API quản trị</h1>
              <p className="text-gray-400 text-sm mt-1">Tạo mã đổi thưởng (redeem code) qua API bằng token quản trị.</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
              <h3 className="text-white font-medium mb-3">🔑 Token API</h3>
              {apiToken ? (
                <div className="space-y-3">
                  <div className="bg-gray-800 rounded-lg p-3 font-mono text-sm break-all flex items-center gap-2">
                    <span className={apiTokenVisible ? "text-teal-400" : "text-gray-500"}>
                      {apiTokenVisible ? apiToken : "•".repeat(32)}
                    </span>
                    <button onClick={() => setApiTokenVisible(v => !v)} className="ml-auto text-xs text-gray-400 hover:text-white shrink-0">
                      {apiTokenVisible ? "Ẩn" : "Hiện"}
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(apiToken)} className="text-xs text-purple-400 hover:text-purple-300 shrink-0">Copy</button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={generateApiToken} disabled={apiTokenSaving}
                      className="text-xs bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg">Tạo lại</button>
                    <button onClick={revokeApiToken} disabled={apiTokenSaving}
                      className="text-xs border border-red-800/40 text-red-400 hover:bg-red-900/20 px-3 py-1.5 rounded-lg">Vô hiệu hoá</button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-gray-400 text-sm mb-3">Chưa có token. Tạo token để bật API.</p>
                  <button onClick={generateApiToken} disabled={apiTokenSaving}
                    className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm">
                    {apiTokenSaving ? "Đang tạo..." : "Tạo token"}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
              <h3 className="text-white font-medium mb-3">📘 Tạo mã đổi thưởng</h3>
              <div className="text-sm text-gray-400 mb-2"><span className="text-green-400 font-mono">POST</span> <span className="font-mono text-white">/api/admin/redeem-codes</span></div>
              <div className="text-xs text-gray-500 mb-1">Headers</div>
              <pre className="bg-gray-800 rounded-lg p-3 text-xs font-mono text-gray-300 overflow-x-auto mb-3">{`Authorization: Bearer <token>
Content-Type: application/json`}</pre>
              <div className="text-xs text-gray-500 mb-1">Body</div>
              <pre className="bg-gray-800 rounded-lg p-3 text-xs font-mono text-gray-300 overflow-x-auto mb-3">{`{
  "amount": 5,           // USD, bắt buộc, > 0
  "count": 1,            // tuỳ chọn, 1-100 (mặc định 1)
  "note": "promo Q2",    // tuỳ chọn
  "expireDays": 30,      // tuỳ chọn — hạn ĐỔI mã (sau X ngày mã hết hạn không đổi được)
                         //           hoặc dùng "expiresAt": "2026-12-31"
  "creditDays": 1        // tuỳ chọn — hạn DÙNG credit sau khi đổi (X ngày)
                         //           bỏ trống = dùng default Setting redeem_default_days
}`}</pre>
              <div className="text-xs text-gray-500 mb-1">Phản hồi</div>
              <pre className="bg-gray-800 rounded-lg p-3 text-xs font-mono text-gray-300 overflow-x-auto mb-3">{`{ "codes": [ { "id": "...", "code": "ABCDEF...", "amount": 5, "expiresAt": "...", "creditDays": 1 } ] }`}</pre>
              <div className="text-xs text-gray-500 mb-1">Ví dụ curl</div>
              <pre className="bg-gray-800 rounded-lg p-3 text-xs font-mono text-gray-300 overflow-x-auto">{`curl -X POST ${typeof window !== "undefined" ? window.location.origin : ""}/api/admin/redeem-codes \\
  -H "Authorization: Bearer ${apiToken || "<token>"}" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 5, "count": 10, "expireDays": 30, "creditDays": 1}'`}</pre>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-medium mb-3">📋 Liệt kê mã</h3>
              <div className="text-sm text-gray-400 mb-2"><span className="text-blue-400 font-mono">GET</span> <span className="font-mono text-white">/api/admin/redeem-codes?limit=50&unused=1</span></div>
              <p className="text-xs text-gray-500">Trả về tối đa 200 mã, sắp xếp mới nhất trước. <code className="text-gray-400">unused=1</code> để chỉ lấy mã chưa dùng.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
