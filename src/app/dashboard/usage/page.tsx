"use client";

import { useEffect, useState, useCallback } from "react";
import { useLang } from "@/lib/i18n";

interface UsageLog {
  id: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  createdAt: string;
}

export default function UsagePage() {
  const { t } = useLang();
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const fetchLogs = useCallback(async (cursor?: string) => {
    const url = `/api/billing?type=usage${cursor ? `&cursor=${cursor}` : ""}`;
    const r = await fetch(url);
    const d = await r.json();
    return { logs: (d.logs || d) as UsageLog[], nextCursor: d.nextCursor as string | null };
  }, []);

  useEffect(() => {
    fetchLogs().then(({ logs: items, nextCursor: nc }) => {
      setLogs(items);
      setNextCursor(nc);
      setLoading(false);
    });
  }, [fetchLogs]);

  async function refresh() {
    setLoading(true);
    const { logs: items, nextCursor: nc } = await fetchLogs();
    setLogs(items);
    setNextCursor(nc);
    setLoading(false);
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    const { logs: more, nextCursor: nc } = await fetchLogs(nextCursor);
    setLogs(prev => [...prev, ...more]);
    setNextCursor(nc);
    setLoadingMore(false);
  }

  const filtered = filter ? logs.filter((l) => l.model.includes(filter)) : logs;

  const totalCost = filtered.reduce((s, l) => s + l.cost, 0);
  const totalTokens = filtered.reduce((s, l) => s + l.inputTokens + l.outputTokens, 0);
  const totalRequests = filtered.length;

  // Group by model
  const byModel: Record<string, { requests: number; tokens: number; cost: number }> = {};
  for (const l of logs) {
    if (!byModel[l.model]) byModel[l.model] = { requests: 0, tokens: 0, cost: 0 };
    byModel[l.model].requests += 1;
    byModel[l.model].tokens += l.inputTokens + l.outputTokens;
    byModel[l.model].cost += l.cost;
  }
  const modelSorted = Object.entries(byModel).sort((a, b) => b[1].cost - a[1].cost);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{t.usage.title}</h1>
        <p className="text-gray-400 text-sm mt-1">{t.usage.subtitle}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{t.dash.todayReqs.replace("Hôm nay", "").replace("Today", "").trim() || t.dash.total} {t.dash.reqs}</p>
          <p className="text-2xl font-bold text-white">{totalRequests.toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{t.dash.total} {t.usage.tokens}</p>
          <p className="text-2xl font-bold text-white">{totalTokens.toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{t.dash.total} {t.usage.cost}</p>
          <p className="text-2xl font-bold text-white">${totalCost.toFixed(6)}</p>
        </div>
      </div>

      {/* By model */}
      {modelSorted.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl mb-6">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="font-semibold text-white">{t.usage.model}</h2>
          </div>
          <div className="p-6 space-y-3">
            {modelSorted.map(([model, stats]) => (
              <div key={model}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <code className="text-gray-300 text-xs">{model}</code>
                  <div className="flex gap-6 text-xs text-gray-500">
                    <span>{stats.requests} reqs</span>
                    <span>{stats.tokens.toLocaleString()} tokens</span>
                    <span className="text-indigo-400">${stats.cost.toFixed(6)}</span>
                  </div>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full"
                    style={{ width: `${(stats.cost / totalCost) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-white">{t.usage.title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={loading}
              title="Refresh"
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 text-gray-300 rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors"
            >
              <span className={loading ? "inline-block animate-spin" : "inline-block"}>⟳</span>
              <span>Refresh</span>
            </button>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t.usage.allModels}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-xs focus:border-indigo-500 transition-colors w-48"
            />
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">{t.usage.noData}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase">
                    <th className="px-6 py-3 text-left">{t.usage.model}</th>
                    <th className="px-6 py-3 text-right">{t.usage.inputT}</th>
                    <th className="px-6 py-3 text-right">{t.usage.outputT}</th>
                    <th className="px-6 py-3 text-right">{t.usage.cost}</th>
                    <th className="px-6 py-3 text-right">{t.usage.time}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filtered.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-800/30">
                      <td className="px-6 py-3">
                        <code className="text-gray-300 text-xs">{l.model}</code>
                      </td>
                      <td className="px-6 py-3 text-right text-gray-400 text-xs">{l.inputTokens.toLocaleString()}</td>
                      <td className="px-6 py-3 text-right text-gray-400 text-xs">{l.outputTokens.toLocaleString()}</td>
                      <td className="px-6 py-3 text-right text-indigo-400 text-xs">${l.cost.toFixed(8)}</td>
                      <td className="px-6 py-3 text-right text-gray-500 text-xs">
                        {new Date(l.createdAt).toLocaleString("vi-VN", {
                          timeZone: "Asia/Ho_Chi_Minh",
                          month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {nextCursor && !filter && (
              <div className="px-6 py-4 border-t border-gray-800 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                  {loadingMore ? (
                    <><span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />Đang tải...</>
                  ) : "Tải thêm"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
