"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { useLang } from "@/lib/i18n";

interface UsageItem {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  createdAt: string;
}

interface Stats {
  balance: number;
  activeKeys: number;
  todayRequests: number;
  totalRequests: number;
  todayCost: number;
  totalCost: number;
  todayInputTokens: number;
  todayOutputTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

const PIE_COLORS = ["#6366f1", "#06b6d4", "#a78bfa", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6"];

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { t } = useLang();
  const [stats, setStats] = useState<Stats | null>(null);
  const [usage, setUsage] = useState<UsageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<string>("");

  useEffect(() => {
    async function load() {
      const [billingRes, usageRes, keysRes] = await Promise.all([
        fetch("/api/billing"),
        fetch("/api/billing?type=usage"),
        fetch("/api/keys"),
      ]);
      const billing = await billingRes.json();
      const usageData = await usageRes.json();
      const logs: UsageItem[] = Array.isArray(usageData) ? usageData : (usageData.logs || []);
      const keys = await keysRes.json();

      const todayLogs = logs.filter((l) => isToday(l.createdAt));

      setStats({
        balance: billing.balance || 0,
        activeKeys: keys.filter((k: { status: string }) => k.status === "active").length,
        todayRequests: todayLogs.length,
        totalRequests: logs.length,
        todayCost: todayLogs.reduce((s, l) => s + l.cost, 0),
        totalCost: logs.reduce((s, l) => s + l.cost, 0),
        todayInputTokens: todayLogs.reduce((s, l) => s + l.inputTokens, 0),
        todayOutputTokens: todayLogs.reduce((s, l) => s + l.outputTokens, 0),
        totalInputTokens: logs.reduce((s, l) => s + l.inputTokens, 0),
        totalOutputTokens: logs.reduce((s, l) => s + l.outputTokens, 0),
      });
      setUsage(logs);
      setLoading(false);
    }
    load();
  }, []);

  // Build pie chart data from model distribution
  const modelMap: Record<string, { requests: number; tokens: number; cost: number }> = {};
  for (const l of usage) {
    if (!modelMap[l.model]) modelMap[l.model] = { requests: 0, tokens: 0, cost: 0 };
    modelMap[l.model].requests++;
    modelMap[l.model].tokens += l.inputTokens + l.outputTokens;
    modelMap[l.model].cost += l.cost;
  }
  const pieData = Object.entries(modelMap).map(([name, v]) => ({ name, value: v.requests, tokens: v.tokens, cost: v.cost }));

  // Build line chart data (last 7 days)
  const dayMap: Record<string, { input: number; output: number }> = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dayMap[d.toISOString().slice(0, 10)] = { input: 0, output: 0 };
  }
  for (const l of usage) {
    const day = new Date(l.createdAt).toISOString().slice(0, 10);
    if (dayMap[day]) {
      dayMap[day].input += l.inputTokens;
      dayMap[day].output += l.outputTokens;
    }
  }
  const lineData = Object.entries(dayMap).map(([date, v]) => ({
    date: date.slice(5),
    Input: v.input,
    Output: v.output,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const s = stats!;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">{t.dash.title}</h1>
        <p className="text-gray-400 text-sm mt-0.5">{t.dash.welcome}</p>
      </div>

      {/* Stats grid — top row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          label={t.dash.balance}
          value={`${s.balance.toFixed(2)} cr`}
          sub={t.dash.available}
          icon="💳"
          color="text-green-400"
        />
        <StatCard
          label={t.dash.apiKeys}
          value={String(s.activeKeys)}
          sub={`${s.activeKeys} ${t.dash.active}`}
          icon="🔑"
          color="text-indigo-400"
        />
        <StatCard
          label={t.dash.todayReqs}
          value={s.todayRequests.toLocaleString()}
          sub={`${t.dash.total}: ${s.totalRequests.toLocaleString()}`}
          icon="📊"
          color="text-cyan-400"
        />
        <StatCard
          label={t.dash.todayCost}
          value={`$${s.todayCost.toFixed(4)}`}
          sub={`${t.dash.total}: $${s.totalCost.toFixed(4)}`}
          icon="💰"
          color="text-purple-400"
        />
      </div>

      {/* Stats grid — bottom row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={t.dash.todayTokens}
          value={formatTokens(s.todayInputTokens + s.todayOutputTokens)}
          sub={`${t.dash.input}: ${formatTokens(s.todayInputTokens)} / ${t.dash.output}: ${formatTokens(s.todayOutputTokens)}`}
          icon="⚡"
          color="text-yellow-400"
        />
        <StatCard
          label={t.dash.totalTokens}
          value={formatTokens(s.totalInputTokens + s.totalOutputTokens)}
          sub={`${t.dash.input}: ${formatTokens(s.totalInputTokens)} / ${t.dash.output}: ${formatTokens(s.totalOutputTokens)}`}
          icon="🗄️"
          color="text-blue-400"
        />
        <StatCard label={t.dash.performance} value="0 RPM" sub="0 TPM" icon="⚡" color="text-orange-400" />
        <StatCard label={t.dash.avgResponse} value="—" sub={t.dash.avgTime} icon="🕐" color="text-red-400" />
      </div>

      {/* Charts row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">{t.dash.timeRange}:</span>
          <select
            value={timeRange || t.dash.last7}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5"
          >
            {[t.dash.last7, t.dash.last15, t.dash.last30].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <button className="border border-gray-700 text-gray-400 hover:text-white text-sm px-3 py-1.5 rounded-lg transition-colors">
            {t.dash.refresh}
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>{t.dash.granularity}:</span>
          <select className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5">
            <option>{t.dash.day}</option>
            <option>{t.dash.hour}</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* Model Distribution */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">{t.dash.modelDist}</h2>
          {pieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-600">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm">{t.dash.noData}</p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} reqs`]} contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 uppercase">
                      <th className="pb-2 text-left">{t.usage.model}</th>
                      <th className="pb-2 text-right">{t.dash.reqs}</th>
                      <th className="pb-2 text-right">{t.usage.tokens}</th>
                      <th className="pb-2 text-right">{t.usage.cost}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pieData.map((d, i) => (
                      <tr key={d.name} className="border-t border-gray-800">
                        <td className="py-1.5 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <code className="text-gray-300 truncate max-w-[90px]">{d.name}</code>
                        </td>
                        <td className="py-1.5 text-right text-gray-400">{d.value}</td>
                        <td className="py-1.5 text-right text-gray-400">{formatTokens(d.tokens)}</td>
                        <td className="py-1.5 text-right text-green-400">${d.cost.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Token Usage Trend */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">{t.dash.tokenTrend}</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={lineData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatTokens(v)} width={45} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
                formatter={(v: unknown, name: unknown) => [formatTokens(Number(v)), String(name)]}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: "#9ca3af" }} />
              <Line type="monotone" dataKey="Input" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Output" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Usage + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-white">{t.dash.recentUsage}</h2>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">{t.dash.last7days}</span>
          </div>
          {usage.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <p className="text-2xl mb-2">📭</p>
              <p className="text-sm">{t.dash.noUsage}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {usage.slice(0, 8).map((u, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-gray-800/30">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-900/50 border border-indigo-800/50 flex items-center justify-center text-indigo-400 text-xs">⚗</div>
                    <div>
                      <code className="text-gray-300 text-xs font-medium">{u.model}</code>
                      <p className="text-gray-600 text-xs mt-0.5">
                        {new Date(u.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 text-xs font-medium">${u.cost.toFixed(4)}</p>
                    <p className="text-gray-600 text-xs">{(u.inputTokens + u.outputTokens).toLocaleString()} tokens</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">{t.dash.quickActions}</h2>
          <div className="space-y-2">
            {[
              { icon: "🔑", label: t.dash.createKey, sub: t.dash.createKeySub, href: "/dashboard/api-keys" },
              { icon: "📊", label: t.dash.viewUsage, sub: t.dash.viewUsageSub, href: "/dashboard/usage" },
              { icon: "💳", label: t.dash.recharge, sub: t.dash.rechargeSub, href: "/dashboard/billing" },
            ].map((a) => (
              <a
                key={a.href}
                href={a.href}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{a.icon}</span>
                  <div>
                    <p className="text-white text-sm font-medium">{a.label}</p>
                    <p className="text-gray-500 text-xs">{a.sub}</p>
                  </div>
                </div>
                <span className="text-gray-600 group-hover:text-gray-400 transition-colors">›</span>
              </a>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-500 mb-2">{t.dash.loggedAs}</p>
            <p className="text-white text-sm font-medium truncate">{session?.user?.name || session?.user?.email}</p>
            <p className="text-gray-500 text-xs truncate">{session?.user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon, color }: { label: string; value: string; sub: string; icon: string; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        <span className="text-base">{icon}</span>
      </div>
      <p className={`text-xl font-bold ${color} mb-0.5`}>{value}</p>
      <p className="text-xs text-gray-600">{sub}</p>
    </div>
  );
}
