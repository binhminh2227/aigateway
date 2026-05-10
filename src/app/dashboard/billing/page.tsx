"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useLang } from "@/lib/i18n";

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500, 1000, 2000];
const EXPIRE_MINUTES = 15;

interface PaymentConfig {
  bank_name?: string;
  bank_account?: string;
  bank_holder?: string;
  bank_content?: string;
  usdt_trc20?: string;
  usdt_erc20?: string;
  usdt_rate?: string;
  web2m_enabled?: string;
  web2m_bank_bin?: string;
  web2m_vietqr?: string;
  usd_to_vnd?: string;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  duration: number;
  dailyLimit: number;
  concurrencyLimit: number;
  description: string | null;
  features: string;
  enabled: boolean;
}

interface PendingTx {
  id: string;
  amount: number;
  payCode: string;
  expiresAt: string;
  type: "topup" | "subscribe";
  planName?: string;
  method?: string;
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-teal-800 text-gray-300 hover:text-white transition-all ml-2"
    >
      {copied ? "✓ Đã chép" : "Copy"}
    </button>
  );
}

function Countdown({ expiresAt, onExpired }: { expiresAt: string; onExpired: () => void }) {
  const [remaining, setRemaining] = useState(0);
  const expiredRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setRemaining(diff);
      if (diff === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpired();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpired]);

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const pct = (remaining / (EXPIRE_MINUTES * 60 * 1000)) * 100;
  const urgent = remaining < 3 * 60 * 1000;

  return (
    <div className={`rounded-xl p-3 border text-center ${urgent ? "border-red-800/50 bg-red-900/20" : "border-yellow-800/40 bg-yellow-900/10"}`}>
      <p className="text-xs text-gray-500 mb-1">Hết hạn sau</p>
      <p className={`text-2xl font-mono font-bold ${urgent ? "text-red-400" : "text-yellow-400"}`}>
        {mins.toString().padStart(2, "0")}:{secs.toString().padStart(2, "0")}
      </p>
      <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${urgent ? "bg-red-500" : "bg-yellow-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PaymentModal({
  tx,
  payConfig,
  onClose,
  onSuccess,
}: {
  tx: PendingTx;
  payConfig: PaymentConfig;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const vndRate = parseFloat(payConfig.usd_to_vnd || "0");
  const vndAmount = tx.type === "subscribe"
    ? Math.round(tx.amount)
    : (vndRate > 0 ? Math.round(tx.amount * vndRate) : 0);
  const [expired, setExpired] = useState(false);
  const [polling, setPolling] = useState(true);
  const [checkCount, setCheckCount] = useState(0);

  const bankBin = payConfig.web2m_bank_bin || "";
  const qrUrl = (bankBin && payConfig.bank_account)
    ? `https://img.vietqr.io/image/${bankBin}-${payConfig.bank_account}-compact2.png?amount=${vndAmount || ""}&addInfo=${encodeURIComponent(tx.payCode)}&accountName=${encodeURIComponent(payConfig.bank_holder || "")}`
    : null;

  const checkStatus = useCallback(async () => {
    try {
      const r = await fetch(`/api/billing/status?id=${tx.id}`);
      const data = await r.json();
      if (data.status === "completed") {
        setPolling(false);
        onSuccess();
      } else if (data.status === "expired") {
        setPolling(false);
        setExpired(true);
      }
      setCheckCount(c => c + 1);
    } catch { /* ignore */ }
  }, [tx.id, onSuccess]);

  useEffect(() => {
    if (!polling) return;
    const id = setInterval(checkStatus, 4000);
    return () => clearInterval(id);
  }, [polling, checkStatus]);

  const handleExpired = useCallback(() => {
    setExpired(true);
    setPolling(false);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h3 className="text-white font-bold text-sm">
              {tx.type === "subscribe" ? `📦 Đăng ký gói` : `💳 Nạp tiền`}
            </h3>
            {tx.planName && <p className="text-gray-500 text-xs mt-0.5">{tx.planName}</p>}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {expired ? (
            <div className="text-center py-6">
              <p className="text-4xl mb-3">⏰</p>
              <p className="text-white font-semibold">Giao dịch đã hết hạn</p>
              <p className="text-gray-500 text-sm mt-1">Vui lòng tạo giao dịch mới</p>
              <button onClick={onClose} className="mt-4 w-full bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-xl text-sm font-medium transition-all">
                Đóng
              </button>
            </div>
          ) : (
            <>
              {/* Countdown */}
              <Countdown expiresAt={tx.expiresAt} onExpired={handleExpired} />

              {/* Amount */}
              <div className="bg-gray-800/60 rounded-xl px-4 py-3 flex justify-between items-center">
                <span className="text-gray-400 text-sm">Số tiền</span>
                <div className="text-right">
                  {tx.type === "subscribe" ? (
                    <p className="text-white font-bold">{Math.round(tx.amount).toLocaleString("vi-VN")}₫</p>
                  ) : (
                    <>
                      <p className="text-white font-bold">${tx.amount.toFixed(2)}</p>
                      {vndAmount > 0 && <p className="text-teal-400 text-xs">{vndAmount.toLocaleString("vi-VN")}₫</p>}
                    </>
                  )}
                </div>
              </div>

              {/* Payment warning */}
              <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl px-4 py-3 text-amber-200 text-xs leading-relaxed">
                ⚠ Vui lòng thanh toán <b>đúng số tiền</b>. Nếu thanh toán <b>thiếu</b>, hệ thống sẽ <b>không tự cộng</b> — bạn cần liên hệ admin. Nếu thanh toán <b>dư</b>, phần dư sẽ được cộng vào số dư.
              </div>

              {/* Pay code - most important */}
              <div className="bg-teal-900/20 border border-teal-800/50 rounded-xl p-4">
                <p className="text-teal-400 text-xs mb-2 font-medium">Nội dung chuyển khoản (bắt buộc)</p>
                <div className="flex items-center justify-between">
                  <span className="text-white font-mono font-bold text-xl tracking-widest">{tx.payCode}</span>
                  <CopyBtn value={tx.payCode} />
                </div>
                <p className="text-gray-600 text-xs mt-2">Ghi đúng mã này để hệ thống tự nhận tiền</p>
              </div>

              {/* Bank info */}
              {payConfig.bank_account && (
                <div className="bg-gray-800/60 rounded-xl p-4 space-y-2">
                  {payConfig.bank_name && (
                    <p className="text-white font-semibold text-sm">🏦 {payConfig.bank_name}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Số tài khoản</span>
                    <div className="flex items-center">
                      <span className="text-teal-300 font-mono font-bold tracking-widest">{payConfig.bank_account}</span>
                      <CopyBtn value={payConfig.bank_account} />
                    </div>
                  </div>
                  {payConfig.bank_holder && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 text-xs">Chủ tài khoản</span>
                      <span className="text-white text-xs font-medium">{payConfig.bank_holder}</span>
                    </div>
                  )}
                  {vndAmount > 0 && (
                    <div className="flex items-center justify-between border-t border-gray-700 pt-2">
                      <span className="text-gray-500 text-xs">Số tiền</span>
                      <div className="flex items-center">
                        <span className="text-white font-bold font-mono">{vndAmount.toLocaleString("vi-VN")}₫</span>
                        <CopyBtn value={String(vndAmount)} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* QR code */}
              {qrUrl && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-gray-500 text-xs">Quét mã QR để chuyển khoản nhanh</p>
                  <img
                    src={qrUrl}
                    alt="VietQR"
                    className="w-48 h-48 rounded-xl border border-gray-700"
                    onError={e => (e.currentTarget.style.display = "none")}
                  />
                </div>
              )}

              {/* Polling indicator */}
              <div className="flex items-center gap-2 text-xs text-gray-600 justify-center">
                <span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
                <span>Đang chờ xác nhận thanh toán... ({checkCount} lần kiểm tra)</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { t } = useLang();
  const [tab, setTab] = useState<"topup" | "subscribe">("topup");
  const [balance, setBalance] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(0);
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [upgradeMsg, setUpgradeMsg] = useState<string>("");
  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"bank" | "usdt" | "web2m">("bank");
  const [submitting, setSubmitting] = useState(false);
  const [payConfig, setPayConfig] = useState<PaymentConfig>({});
  const [plans, setPlans] = useState<Plan[]>([]);
  const [pendingTx, setPendingTx] = useState<PendingTx | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const refreshBalance = useCallback(() => {
    fetch("/api/billing").then(r => r.json()).then(d => {
      setBalance(d.balance || 0);
      setDailyLimit(d.dailyLimit || 0);
      setPlanExpiresAt(d.planExpiresAt || null);
      setCurrentPlanId(d.currentPlanId || null);
    });
  }, []);

  useEffect(() => {
    refreshBalance();
    fetch("/api/settings").then(r => r.json()).then(d => setPayConfig(d));
    fetch("/api/plans").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setPlans(d);
    }).catch(() => null);
  }, [refreshBalance]);

  const finalAmount = amount ?? (customAmount ? parseFloat(customAmount) : 0);
  const vndRate = parseFloat(payConfig.usd_to_vnd || "0");
  const hasBank = payConfig.bank_name || payConfig.bank_account;
  const hasUsdt = payConfig.usdt_trc20 || payConfig.usdt_erc20;
  const hasWeb2m = payConfig.web2m_enabled === "1" && hasBank;

  async function handleTopUp(e: React.FormEvent) {
    e.preventDefault();
    if (!finalAmount || finalAmount < 1) return;
    setSubmitting(true);

    const res = await fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: finalAmount, method: payMethod }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (data.id && data.payCode) {
      setPendingTx({ id: data.id, amount: data.amount, payCode: data.payCode, expiresAt: data.expiresAt, type: "topup", method: payMethod });
    }
  }

  async function handleBuyPlan(plan: Plan) {
    setSubmitting(true);
    const res = await fetch("/api/billing/buy-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, method: hasWeb2m ? "web2m" : "bank" }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (data.id && data.payCode) {
      setPendingTx({ id: data.id, amount: data.amount, payCode: data.payCode, expiresAt: data.expiresAt, type: "subscribe", planName: plan.name });
    }
  }

  function handlePaymentSuccess() {
    refreshBalance();
    setPendingTx(null);
    setAmount(null);
    setCustomAmount("");
    setSuccessMsg("✓ Thanh toán thành công! Số dư đã được cộng.");
    setTimeout(() => setSuccessMsg(""), 6000);
  }

  return (
    <div>
      {pendingTx && (
        <PaymentModal
          tx={pendingTx}
          payConfig={payConfig}
          onClose={() => setPendingTx(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">{t.billing.title}</h1>
        <p className="text-gray-400 text-sm mt-0.5">{t.billing.subtitle}</p>
      </div>

      <div className="max-w-3xl">
        {successMsg && (
          <div className="mb-4 bg-green-900/40 border border-green-700 text-green-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6">
          <button
            onClick={() => setTab("topup")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === "topup" ? "bg-teal-600 text-white shadow" : "text-gray-500 hover:text-white"}`}
          >
            💳 {t.billing.title}
          </button>
          <button
            onClick={() => setTab("subscribe")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === "subscribe" ? "bg-teal-600 text-white shadow" : "text-gray-500 hover:text-white"}`}
          >
            📦 {t.nav.subscriptions}
          </button>
        </div>

        {tab === "topup" ? (
          <form onSubmit={handleTopUp} className="space-y-4">
            {/* Balance card */}
            <div className="bg-gradient-to-r from-teal-900/30 to-teal-800/10 border border-teal-800/50 rounded-xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-teal-400 text-xs uppercase tracking-wider mb-1">💰 Số dư hiện tại</p>
                <p className="text-white text-2xl font-bold">{balance.toFixed(2)} <span className="text-base font-normal text-teal-400">credit</span></p>
                {vndRate > 0 && <p className="text-teal-600 text-xs mt-0.5">≈ {(balance * vndRate).toLocaleString("vi-VN")}₫</p>}
                {dailyLimit > 0 && (
                  <p className={`text-xs mt-1 ${planExpiresAt && new Date(planExpiresAt) < new Date() ? "text-red-400" : "text-yellow-500"}`}>
                    📦 Gói: ${dailyLimit.toFixed(2)}/ngày
                    {planExpiresAt && ` · HH: ${new Date(planExpiresAt).toLocaleDateString("vi-VN")}`}
                    {planExpiresAt && new Date(planExpiresAt) < new Date() && " ⚠ Đã hết hạn"}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 rounded-full bg-teal-700/30 border border-teal-700/50 flex items-center justify-center text-2xl">💳</div>
            </div>

            {/* Amount selector */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-300 text-sm font-medium mb-3">Chọn số tiền nạp</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {QUICK_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => { setAmount(a); setCustomAmount(""); }}
                    className={`py-3 rounded-lg border text-sm font-medium transition-all ${
                      amount === a
                        ? "border-teal-500 bg-teal-900/40 text-teal-300 shadow-sm shadow-teal-900"
                        : "border-gray-700 text-gray-300 hover:border-teal-700 hover:text-white"
                    }`}
                  >
                    <span className="text-xs text-gray-500">$</span>{a}
                    {vndRate > 0 && <p className="text-xs text-gray-600 mt-0.5">{(a * vndRate / 1000).toFixed(0)}K₫</p>}
                  </button>
                ))}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">$</span>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => { setCustomAmount(e.target.value); setAmount(null); }}
                  placeholder="Nhập số tiền tùy chỉnh (1 - 4000)"
                  min="1" max="4000"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-7 pr-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              {finalAmount > 0 && vndRate > 0 && (
                <p className="text-xs text-gray-500 mt-2">≈ {(finalAmount * vndRate).toLocaleString("vi-VN")}₫</p>
              )}
            </div>

            {/* Payment method */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-300 text-sm font-medium mb-3">{t.billing.method}</p>
              <div className="flex flex-wrap gap-2 mb-0">
                {hasWeb2m && (
                  <button type="button" onClick={() => setPayMethod("web2m")}
                    className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      payMethod === "web2m"
                        ? "border-teal-500 bg-teal-900/40 text-teal-300"
                        : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
                    }`}>
                    ⚡ Chuyển khoản tự động
                  </button>
                )}
                {hasBank && (
                  <button type="button" onClick={() => setPayMethod("bank")}
                    className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      payMethod === "bank"
                        ? "border-teal-500 bg-teal-900/40 text-teal-300"
                        : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
                    }`}>
                    🏦 {t.billing.bank}
                  </button>
                )}
                {hasUsdt && (
                  <button type="button" onClick={() => setPayMethod("usdt")}
                    className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      payMethod === "usdt"
                        ? "border-teal-500 bg-teal-900/40 text-teal-300"
                        : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
                    }`}>
                    🪙 {t.billing.usdt}
                  </button>
                )}
                {!hasBank && !hasUsdt && !hasWeb2m && (
                  <p className="text-gray-500 text-sm italic">Chưa có phương thức thanh toán. Liên hệ admin.</p>
                )}
              </div>

              {payMethod === "usdt" && hasUsdt && (
                <div className="bg-gray-800/60 rounded-xl p-4 space-y-3 mt-4">
                  {payConfig.usdt_trc20 && (
                    <div className="bg-gray-900 rounded-lg p-3">
                      <p className="text-gray-500 text-xs mb-1.5">🔵 TRC20 (TRON)</p>
                      <p className="text-teal-300 font-mono text-xs break-all">{payConfig.usdt_trc20}</p>
                    </div>
                  )}
                  {payConfig.usdt_erc20 && (
                    <div className="bg-gray-900 rounded-lg p-3">
                      <p className="text-gray-500 text-xs mb-1.5">🔷 ERC20 (Ethereum)</p>
                      <p className="text-teal-300 font-mono text-xs break-all">{payConfig.usdt_erc20}</p>
                    </div>
                  )}
                </div>
              )}

              {(payMethod === "bank" || payMethod === "web2m") && hasBank && (
                <div className="bg-gray-800/40 rounded-xl p-4 space-y-2 mt-4 border border-gray-700/50">
                  {payMethod === "web2m" && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-teal-900/50 text-teal-400 border border-teal-800/50 px-2 py-0.5 rounded-full">⚡ Tự động xác nhận</span>
                    </div>
                  )}
                  <p className="text-gray-400 text-xs">Thông tin nhận tiền sẽ hiện sau khi xác nhận</p>
                  {payConfig.bank_name && <p className="text-white text-sm font-medium">🏦 {payConfig.bank_name}</p>}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 text-xs">Số TK</span>
                    <span className="text-teal-300 font-mono font-bold">{payConfig.bank_account}</span>
                  </div>
                  {payConfig.bank_holder && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Chủ TK</span>
                      <span className="text-white">{payConfig.bank_holder}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !finalAmount || finalAmount < 1 || payMethod === "usdt"}
              className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition-all shadow-lg shadow-teal-900/30"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Đang tạo giao dịch...
                </span>
              ) : payMethod === "usdt" ? (
                "Liên hệ admin để nạp USDT"
              ) : (
                `⚡ Tạo lệnh nạp $${finalAmount > 0 ? finalAmount.toFixed(2) : "0.00"}`
              )}
            </button>
          </form>
        ) : (
          /* Subscriptions tab */
          <div>
            {upgradeMsg && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${upgradeMsg.startsWith("✓") ? "bg-teal-900/30 border border-teal-700 text-teal-300" : "bg-red-900/30 border border-red-700 text-red-300"}`}>
                {upgradeMsg}
              </div>
            )}
            {plans.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                <p className="text-4xl mb-4">📦</p>
                <p className="font-medium text-gray-400">Chưa có gói dịch vụ</p>
                <p className="text-sm mt-1">Admin chưa cấu hình gói nào.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {plans.map((p) => {
                  const features: string[] = (() => { try { return JSON.parse(p.features); } catch { return []; } })();
                  const pricePerDay = p.duration > 0 ? (p.price / p.duration) : 0;
                  const isCurrent = currentPlanId === p.id && planExpiresAt && new Date(planExpiresAt) > new Date();
                  const hasActivePlan = currentPlanId && planExpiresAt && new Date(planExpiresAt) > new Date();
                  const canUpgrade = hasActivePlan && !isCurrent;
                  const currentPlan = plans.find(x => x.id === currentPlanId);
                  let estRefundVnd = 0;
                  if (canUpgrade && currentPlan && planExpiresAt) {
                    const daysLeft = Math.max(0, Math.floor((new Date(planExpiresAt).getTime() - Date.now()) / 86400000));
                    const perDay = Math.round(currentPlan.price / currentPlan.duration);
                    estRefundVnd = daysLeft * perDay;
                  }
                  const netUpgradeVnd = Math.max(0, Math.round(p.price - estRefundVnd));
                  return (
                    <div key={p.id} className={`bg-gray-900 border ${isCurrent ? "border-teal-500" : "border-gray-800 hover:border-teal-800/60"} rounded-2xl p-5 flex flex-col transition-all group relative`}>
                      {isCurrent && (
                        <span className="absolute -top-2 right-4 bg-teal-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">ĐANG DÙNG</span>
                      )}
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-white font-bold text-base">{p.name}</p>
                          <span className="bg-purple-900/40 border border-purple-700/50 text-purple-300 text-[10px] font-semibold px-2 py-0.5 rounded">OpenAI GPT Pro</span>
                        </div>
                        {p.description && <p className="text-gray-500 text-xs">{p.description}</p>}
                      </div>

                      <div className="bg-gray-800/60 rounded-xl p-4 mb-4">
                        <div className="flex items-end gap-1 mb-1">
                          <span className="text-white text-3xl font-extrabold">{p.price.toLocaleString("vi-VN")}</span>
                          <span className="text-teal-400 text-lg font-bold mb-0.5">₫</span>
                          <span className="text-gray-500 text-xs mb-1">/{p.duration} ngày</span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-700 space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Chi phí/ngày</span>
                            <span className="text-gray-300">{Math.round(pricePerDay).toLocaleString("vi-VN")}₫</span>
                          </div>
                          {p.dailyLimit > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Hạn mức/ngày</span>
                              <span className="text-teal-400 font-semibold">{p.dailyLimit.toFixed(2)} credit</span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Luồng đồng thời</span>
                            <span className="text-amber-400 font-semibold">{p.concurrencyLimit} luồng</span>
                          </div>
                        </div>
                      </div>

                      {features.length > 0 && (
                        <ul className="space-y-1.5 mb-4 flex-1">
                          {features.map(f => (
                            <li key={f} className="flex items-start gap-2 text-xs text-gray-400">
                              <span className="text-teal-400 mt-0.5">✓</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {isCurrent ? (
                        <button disabled className="w-full mt-auto bg-teal-900/30 border border-teal-800 text-teal-300 text-sm font-medium py-2.5 rounded-xl">
                          Đang sử dụng
                        </button>
                      ) : canUpgrade ? (
                        <button
                          onClick={async () => {
                            setUpgradeMsg("");
                            const res = await fetch("/api/billing/upgrade-plan", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ planId: p.id, method: payMethod }),
                            });
                            const d = await res.json();
                            if (res.ok) {
                              setPendingTx({ id: d.id, amount: d.amount, payCode: d.payCode, expiresAt: d.expiresAt, type: "subscribe", planName: d.planName, method: d.method });
                              setUpgradeMsg(`✓ Đã tạo lệnh nâng cấp. Hoàn ${d.refundVnd.toLocaleString("vi-VN")}₫, thanh toán thêm ${d.netVnd.toLocaleString("vi-VN")}₫.`);
                            } else {
                              setUpgradeMsg(`✗ ${d.error || "Lỗi nâng cấp"}`);
                            }
                          }}
                          disabled={submitting}
                          className="w-full mt-auto bg-amber-700 hover:bg-amber-600 border border-amber-600 text-white text-sm font-medium py-2.5 rounded-xl transition-all disabled:opacity-50"
                        >
                          ⬆ Nâng cấp — hoàn {estRefundVnd.toLocaleString("vi-VN")}₫, đóng thêm {netUpgradeVnd.toLocaleString("vi-VN")}₫
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBuyPlan(p)}
                          disabled={submitting}
                          className="w-full mt-auto bg-gray-800 group-hover:bg-teal-600 border border-gray-700 group-hover:border-teal-500 text-gray-300 group-hover:text-white text-sm font-medium py-2.5 rounded-xl transition-all disabled:opacity-50"
                        >
                          ⚡ Đăng ký — {p.price.toLocaleString("vi-VN")}₫
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
