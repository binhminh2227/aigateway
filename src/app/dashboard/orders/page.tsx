"use client";

import { useEffect, useState } from "react";

interface Transaction {
  id: string;
  amount: number;
  method: string;
  status: string;
  note: string | null;
  createdAt: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    fetch("/api/billing")
      .then((r) => r.json())
      .then((d) => { setOrders(d.transactions || []); setLoading(false); });
  }, []);

  const filtered = filter === "All" ? orders : orders.filter((o) => o.status === filter.toLowerCase());

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Lịch sử nạp tiền</h1>
        <p className="text-gray-400 text-sm mt-0.5">Xem lịch sử nạp tiền và thanh toán của bạn</p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-4 py-2"
        >
          {["All", "Completed", "Pending", "Failed", "Expired"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button
          onClick={() => { setLoading(true); fetch("/api/billing").then(r => r.json()).then(d => { setOrders(d.transactions || []); setLoading(false); }); }}
          className="border border-gray-700 text-gray-400 hover:text-white px-3 py-2 rounded-lg text-sm transition-colors"
        >
          ↻
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
              <th className="px-5 py-3 text-left">Order ID</th>
              <th className="px-5 py-3 text-left">Method</th>
              <th className="px-5 py-3 text-right">Amount</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Created</th>
              <th className="px-5 py-3 text-left">Note</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-16">
                <div className="flex justify-center"><div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-16">
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <span className="text-3xl">📭</span>
                  <span className="text-sm">No data found</span>
                </div>
              </td></tr>
            ) : filtered.map((o) => (
              <tr key={o.id} className="border-t border-gray-800 hover:bg-gray-800/30">
                <td className="px-5 py-3 font-mono text-gray-400 text-xs">{o.id.slice(0, 12)}...</td>
                <td className="px-5 py-3 text-gray-300 capitalize">{o.method}</td>
                <td className="px-5 py-3 text-right text-teal-400 font-medium">${o.amount.toFixed(2)}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    o.status === "approved" || o.status === "completed" ? "bg-green-900/40 text-green-400" :
                    o.status === "pending" ? "bg-yellow-900/40 text-yellow-400" :
                    "bg-red-900/40 text-red-400"
                  }`}>{o.status}</span>
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">
                  {new Date(o.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">{o.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
