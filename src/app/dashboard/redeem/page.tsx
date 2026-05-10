"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/lib/i18n";

interface Activity {
  id: string;
  amount: number;
  note: string;
  createdAt: string;
}

export default function RedeemPage() {
  const { t } = useLang();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [balance, setBalance] = useState(0);
  const [redeemBalance, setRedeemBalance] = useState(0);
  const [redeemExpiresAt, setRedeemExpiresAt] = useState<string | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);

  useEffect(() => {
    fetch("/api/billing").then(r => r.json()).then(d => {
      setBalance(d.balance || 0);
      setRedeemBalance(d.redeemBalance || 0);
      setRedeemExpiresAt(d.redeemExpiresAt || null);
      const redeems = (d.transactions || []).filter((t: Activity & { method: string }) => t.method === "redeem_code");
      setActivity(redeems.slice(0, 5));
    });
  }, [msg]);

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setMsg(null);

    const res = await fetch("/api/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setMsg({ type: "success", text: `Đổi thưởng thành công! +${data.amount.toFixed(2)} credit đã cộng vào số dư khuyến mãi.` });
      setCode("");
      setRedeemBalance(b => b + data.amount);
      if (data.expiresAt) setRedeemExpiresAt(data.expiresAt);
    } else {
      setMsg({ type: "error", text: data.error || "Failed to redeem code" });
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">{t.redeem.title}</h1>
        <p className="text-gray-400 text-sm mt-0.5">{t.redeem.subtitle}</p>
      </div>

      <div className="max-w-xl mx-auto space-y-4">
        {/* Balance cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-gradient-to-r from-teal-800/60 to-teal-700/40 border border-teal-700/50 rounded-xl p-6 text-center">
            <div className="w-10 h-10 bg-teal-800/60 rounded-xl flex items-center justify-center text-xl mx-auto mb-2">💳</div>
            <p className="text-gray-300 text-xs mb-1">Số dư chính</p>
            <p className="text-white text-2xl font-bold">${balance.toFixed(2)}</p>
          </div>
          <div className="bg-gradient-to-r from-purple-800/60 to-purple-700/40 border border-purple-700/50 rounded-xl p-6 text-center">
            <div className="w-10 h-10 bg-purple-800/60 rounded-xl flex items-center justify-center text-xl mx-auto mb-2">🎁</div>
            <p className="text-gray-300 text-xs mb-1">Số dư khuyến mãi</p>
            <p className="text-white text-2xl font-bold">${redeemBalance.toFixed(2)}</p>
            {redeemExpiresAt && redeemBalance > 0 && (
              <p className="text-purple-300 text-[10px] mt-1">HSD: {new Date(redeemExpiresAt).toLocaleDateString("vi-VN")}</p>
            )}
          </div>
        </div>

        {/* Redeem form */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <p className="text-white font-medium mb-4">{t.redeem.title}</p>
          <form onSubmit={handleRedeem}>
            {msg && (
              <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.type === "success" ? "bg-green-900/40 border border-green-700 text-green-400" : "bg-red-900/40 border border-red-700 text-red-400"}`}>
                {msg.type === "success" ? "✓" : "✕"} {msg.text}
              </div>
            )}
            <div className="relative mb-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🎁</span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={t.redeem.placeholder}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-9 pr-4 py-3 text-sm focus:border-teal-500 transition-colors font-mono tracking-wider uppercase"
              />
            </div>
            <p className="text-gray-600 text-xs mb-4">Mã tự động viết hoa. Mỗi mã chỉ dùng được một lần.</p>
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-medium py-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : "⊙"
              }
              {loading ? t.common.loading : t.redeem.btn}
            </button>
          </form>
        </div>

        {/* Info */}
        <div className="bg-gray-900 border border-teal-800/40 rounded-xl p-5">
          <p className="text-teal-400 font-medium mb-3 flex items-center gap-2"><span>ℹ</span> About Redeem Codes</p>
          <ul className="space-y-1.5 text-sm text-gray-400">
            {[
              "Each code can only be used once",
              "Codes may add balance, increase concurrency, or grant trial access",
              "Contact support if you have issues redeeming a code",
              "Balance and concurrency updates are immediate",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className="text-teal-400 mt-0.5">•</span>{t}
              </li>
            ))}
          </ul>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-white font-medium mb-4">{t.redeem.history}</p>
          {activity.length === 0 ? (
            <div className="text-center py-6 text-gray-600 text-sm">{t.redeem.noHistory}</div>
          ) : (
            <div className="space-y-2">
              {activity.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <div>
                    <p className="text-white text-sm">Code redeemed</p>
                    <p className="text-gray-500 text-xs">{new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                  <span className="text-teal-400 font-medium text-sm">+${a.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
