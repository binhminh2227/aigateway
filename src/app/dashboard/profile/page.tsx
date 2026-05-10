"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useLang } from "@/lib/i18n";

export default function ProfilePage() {
  const { data: session } = useSession();
  const { t } = useLang();
  const [username, setUsername] = useState("");
  const [balance, setBalance] = useState(0);
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/billing").then(r => r.json()).then(d => setBalance(d.balance || 0));
    setUsername(session?.user?.name || "");
  }, [session]);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    setNameMsg(null);
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: username }),
    });
    setSavingName(false);
    if (res.ok) {
      setNameMsg({ ok: true, text: "Profile updated successfully!" });
    } else {
      const d = await res.json();
      setNameMsg({ ok: false, text: d.error || "Failed to update" });
    }
    setTimeout(() => setNameMsg(null), 3000);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: "New passwords do not match" });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({ ok: false, text: "Password must be at least 8 characters" });
      return;
    }
    setSavingPw(true);
    setPwMsg(null);
    const res = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
    });
    setSavingPw(false);
    if (res.ok) {
      setPwMsg({ ok: true, text: "Password changed successfully!" });
      setCurPw(""); setNewPw(""); setConfirmPw("");
    } else {
      const d = await res.json();
      setPwMsg({ ok: false, text: d.error || "Failed to change password" });
    }
    setTimeout(() => setPwMsg(null), 4000);
  }

  const memberSince = session ? new Date().toLocaleString("en-US", { month: "long", year: "numeric" }) : "";
  const initial = session?.user?.email?.[0]?.toUpperCase() || "?";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">{t.profile.title}</h1>
        <p className="text-gray-400 text-sm mt-0.5">{t.profile.subtitle}</p>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* Account overview */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-teal-700 flex items-center justify-center text-white text-2xl font-bold">
              {initial}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-white font-semibold text-lg">{session?.user?.email}</p>
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                  {session?.user?.role || "User"}
                </span>
                <span className="text-xs bg-green-900/40 text-green-400 border border-green-800/50 px-2 py-0.5 rounded">{t.keys.statusActive}</span>
              </div>
              <p className="text-gray-500 text-sm">{session?.user?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t.profile.balance.toUpperCase(), value: `$${balance.toFixed(2)}` },
              { label: t.profile.concurrency.toUpperCase(), value: "5" },
              { label: t.profile.member.toUpperCase(), value: memberSince },
            ].map((s) => (
              <div key={s.label} className="bg-gray-800/60 border border-gray-700/60 rounded-lg p-3">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{s.label}</p>
                <p className="text-white font-semibold">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Profile & Avatar */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-1">{t.profile.avatarTitle}</h2>
          <p className="text-gray-500 text-sm mb-5">{t.profile.avatarSub}</p>
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-5 text-center">
              <div className="w-14 h-14 rounded-full bg-teal-700 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">
                {initial}
              </div>
              <p className="text-white text-sm font-medium mb-1">{t.profile.avatarLabel}</p>
              <p className="text-gray-500 text-xs mb-4">{t.profile.avatarHint}</p>
              <div className="flex items-center justify-center gap-2">
                <button disabled className="border border-gray-700 text-gray-600 text-xs px-3 py-1.5 rounded-lg cursor-not-allowed">{t.profile.uploadImage}</button>
              </div>
            </div>
            <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-5">
              <p className="text-white text-sm font-medium mb-4">{t.profile.editProfile}</p>
              <form onSubmit={handleSaveName}>
                {nameMsg && (
                  <div className={`mb-3 text-xs px-3 py-2 rounded-lg ${nameMsg.ok ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
                    {nameMsg.text}
                  </div>
                )}
                <label className="block text-gray-400 text-xs mb-1">{t.profile.displayName}</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t.profile.displayName}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:border-teal-500 mb-4"
                />
                <button
                  type="submit"
                  disabled={savingName}
                  className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  {savingName ? t.common.loading : t.profile.update}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Connected Sign-In Methods */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-1">{t.profile.signInMethods}</h2>
          <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-700 rounded-lg flex items-center justify-center text-lg">✉</div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-white text-sm font-medium">{t.profile.email}</p>
                  <span className="text-xs bg-teal-900/40 text-teal-400 border border-teal-800/50 px-2 py-0.5 rounded">{t.profile.bound}</span>
                </div>
                <p className="text-gray-500 text-xs">{session?.user?.email}</p>
                <p className="text-gray-600 text-xs">{t.profile.emailPrimary}</p>
              </div>
            </div>
            <button disabled className="border border-gray-700 text-gray-500 text-xs px-3 py-1.5 rounded-lg">
              {t.profile.manageEmail}
            </button>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-1">{t.profile.changePassword}</h2>
          <form onSubmit={handleChangePassword} className="space-y-3">
            {pwMsg && (
              <div className={`text-xs px-3 py-2 rounded-lg ${pwMsg.ok ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
                {pwMsg.text}
              </div>
            )}
            <div>
              <label className="block text-gray-400 text-xs mb-1">{t.profile.currentPw}</label>
              <input
                type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:border-teal-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 text-xs mb-1">{t.profile.newPw}</label>
                <input
                  type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">{t.profile.confirmPw}</label>
                <input
                  type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:border-teal-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingPw || !curPw || !newPw || !confirmPw}
              className="bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white text-sm px-5 py-2.5 rounded-lg transition-colors font-medium"
            >
              {savingPw ? t.common.loading : t.profile.updatePw}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
