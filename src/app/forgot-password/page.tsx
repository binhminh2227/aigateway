"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const router = useRouter();

  function startResendTimer(sec = 60) {
    setResendIn(sec);
    const t = setInterval(() => {
      setResendIn((v) => {
        if (v <= 1) {
          clearInterval(t);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    const res = await fetch("/api/forgot-password/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Không gửi được mã");
      return;
    }

    setStep(2);
    setInfo(
      data.devCode
        ? `Mã đặt lại (chế độ dev): ${data.devCode}`
        : `Nếu email tồn tại, mã đặt lại đã được gửi tới ${email}.`,
    );
    startResendTimer(60);
  }

  async function handleResend() {
    if (resendIn > 0) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/forgot-password/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Không gửi được mã");
      return;
    }
    setInfo(data.devCode ? `Mã (dev): ${data.devCode}` : "Đã gửi lại mã.");
    startResendTimer(60);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/forgot-password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Đặt lại thất bại");
      setLoading(false);
    } else {
      router.push("/login?reset=1");
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">AI</div>
            <span className="font-semibold text-white text-xl">AI Gateway</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">
            {step === 1 ? "Quên mật khẩu" : "Đặt lại mật khẩu"}
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            {step === 1 ? "Nhập email để nhận mã xác thực" : `Mã đã gửi tới ${email}`}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          {error && (
            <div className="bg-red-950 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}
          {info && (
            <div className="bg-emerald-950 border border-emerald-800 text-emerald-400 text-sm px-4 py-3 rounded-lg mb-4">
              {info}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleSendCode} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
              >
                {loading ? "Đang gửi..." : "Gửi mã"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Mã xác thực (6 chữ số)</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-lg tracking-[0.5em] text-center font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  placeholder="000000"
                />
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendIn > 0 || loading}
                    className="text-xs text-indigo-400 hover:text-indigo-300 disabled:text-gray-600 disabled:cursor-not-allowed"
                  >
                    {resendIn > 0 ? `Gửi lại sau ${resendIn}s` : "Gửi lại mã"}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Mật khẩu mới</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  placeholder="Tối thiểu 6 ký tự"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Xác nhận mật khẩu</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  placeholder="Nhập lại mật khẩu"
                />
              </div>
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
              >
                {loading ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
              </button>
              <button
                type="button"
                onClick={() => { setStep(1); setCode(""); setPassword(""); setConfirm(""); setError(""); setInfo(""); }}
                className="w-full text-xs text-gray-500 hover:text-gray-400"
              >
                ← Đổi email khác
              </button>
            </form>
          )}

          <p className="text-center text-gray-400 text-sm mt-6">
            Nhớ ra mật khẩu?{" "}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
