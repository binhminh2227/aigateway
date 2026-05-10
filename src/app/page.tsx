"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const content = {
  en: {
    nav: { signin: "Sign In", start: "Get Started", docs: "Docs" },
    badge: "OpenAI-Compatible API Gateway",
    hero: {
      title1: "One API Key.",
      title2: "All AI Models.",
      sub: "A unified gateway to the latest AI models. Drop-in replacement for any OpenAI SDK — just change the base URL and key.",
      cta1: "Get Started Free",
      cta2: "View Documentation",
    },
    models_title: "Supported Models",
    features: [
      { icon: "⚡", title: "OpenAI Compatible", desc: "Works with any OpenAI SDK. Zero code changes — swap base URL and API key only." },
      { icon: "🔑", title: "One Key, All Models", desc: "Access GPT-5.5, GPT-5.4, Codex and more through a single API endpoint." },
      { icon: "💰", title: "Pay As You Go", desc: "Top up balance and use only what you need. No subscriptions. No hidden fees." },
      { icon: "🔄", title: "Auto Key Rotation", desc: "Multiple upstream keys rotate automatically on rate limit. Zero downtime." },
      { icon: "🛡️", title: "Access Control", desc: "IP whitelist, quota limits, rate limits and expiry per API key." },
      { icon: "📊", title: "Usage Tracking", desc: "Real-time cost tracking per key, per model, per day." },
    ],
    how_title: "How It Works",
    steps: [
      { n: "1", title: "Register & Top Up", desc: "Create an account and add credits to your balance." },
      { n: "2", title: "Create API Key", desc: "Generate a key from your dashboard with optional restrictions." },
      { n: "3", title: "Start Building", desc: "Point any OpenAI SDK to this gateway and start making calls." },
    ],
    code_label: "Python example",
    footer: "All rights reserved.",
  },
  vi: {
    nav: { signin: "Đăng nhập", start: "Bắt đầu", docs: "Tài liệu" },
    badge: "API Gateway tương thích OpenAI",
    hero: {
      title1: "Một API Key.",
      title2: "Mọi mô hình AI.",
      sub: "Cổng truy cập thống nhất tới các mô hình AI mới nhất. Thay thế trực tiếp OpenAI SDK — chỉ cần đổi base URL và key.",
      cta1: "Dùng miễn phí",
      cta2: "Xem tài liệu",
    },
    models_title: "Các mô hình hỗ trợ",
    features: [
      { icon: "⚡", title: "Tương thích OpenAI", desc: "Hoạt động với mọi OpenAI SDK. Không cần sửa code — chỉ đổi base URL và API key." },
      { icon: "🔑", title: "Một key, mọi model", desc: "Truy cập GPT-5.5, GPT-5.4, Codex và nhiều hơn qua một endpoint duy nhất." },
      { icon: "💰", title: "Trả theo nhu cầu", desc: "Nạp số dư và dùng bao nhiêu tùy thích. Không đăng ký. Không phí ẩn." },
      { icon: "🔄", title: "Tự động xoay key", desc: "Nhiều key upstream tự động xoay khi bị rate limit. Không gián đoạn." },
      { icon: "🛡️", title: "Kiểm soát truy cập", desc: "Whitelist IP, giới hạn quota, rate limit và hết hạn theo từng API key." },
      { icon: "📊", title: "Theo dõi sử dụng", desc: "Theo dõi chi phí theo key, theo model, theo ngày." },
    ],
    how_title: "Cách sử dụng",
    steps: [
      { n: "1", title: "Đăng ký & Nạp tiền", desc: "Tạo tài khoản và nạp số dư vào ví." },
      { n: "2", title: "Tạo API Key", desc: "Tạo key từ dashboard với các giới hạn tùy chọn." },
      { n: "3", title: "Bắt đầu xây dựng", desc: "Trỏ bất kỳ OpenAI SDK nào vào gateway này và bắt đầu gọi API." },
    ],
    code_label: "Ví dụ Python",
    footer: "Đã đăng ký bản quyền.",
  },
};

const models = [
  { id: "gpt-5.5",             label: "GPT-5.5",          tag: "Latest" },
  { id: "gpt-5.4",             label: "GPT-5.4",          tag: "" },
  { id: "gpt-5.4-mini",        label: "GPT-5.4 Mini",     tag: "Fast" },
  { id: "gpt-5.3-codex",       label: "GPT-5.3 Codex",    tag: "Code" },
  { id: "gpt-5.3-codex-spark", label: "GPT-5.3 Codex Spark", tag: "" },
  { id: "gpt-5.2",             label: "GPT-5.2",          tag: "" },
  { id: "gpt-image-1",         label: "GPT Image 1",      tag: "Image" },
  { id: "gpt-image-1.5",       label: "GPT Image 1.5",    tag: "Image" },
  { id: "gpt-image-2",         label: "GPT Image 2",      tag: "Image" },
];

const tagColors: Record<string, string> = {
  Latest: "bg-teal-900/50 text-teal-400 border-teal-800/50",
  Fast:   "bg-blue-900/50 text-blue-400 border-blue-800/50",
  Code:   "bg-purple-900/50 text-purple-400 border-purple-800/50",
  Image:  "bg-orange-900/50 text-orange-400 border-orange-800/50",
};

export default function Home() {
  const [lang, setLang] = useState<"en" | "vi">("vi");
  const [origin, setOrigin] = useState("https://your-gateway.com");
  const t = content[lang];

  useEffect(() => { setOrigin(window.location.origin); }, []);

  return (
    <div className="min-h-screen bg-[#080c14] flex flex-col text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800/60 px-6 py-4 flex items-center justify-between sticky top-0 z-20 bg-[#080c14]/95 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center font-bold text-sm">AI</div>
          <span className="font-bold text-white text-base tracking-wide">AI GATEWAY</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Language toggle */}
          <div className="flex items-center bg-gray-800/60 border border-gray-700 rounded-lg p-0.5">
            <button onClick={() => setLang("en")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${lang === "en" ? "bg-teal-600 text-white" : "text-gray-400 hover:text-white"}`}>
              EN
            </button>
            <button onClick={() => setLang("vi")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${lang === "vi" ? "bg-teal-600 text-white" : "text-gray-400 hover:text-white"}`}>
              VI
            </button>
          </div>
          <Link href="/docs" className="text-gray-400 hover:text-white text-sm transition-colors hidden sm:block">{t.nav.docs}</Link>
          <Link href="/login" className="text-gray-400 hover:text-white text-sm transition-colors">{t.nav.signin}</Link>
          <Link href="/register" className="bg-teal-600 hover:bg-teal-500 text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium">{t.nav.start}</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-teal-950/60 text-teal-400 text-xs px-3 py-1.5 rounded-full mb-8 border border-teal-800/50">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
          {t.badge}
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold mb-4 leading-tight tracking-tight">
          <span className="text-white">{t.hero.title1}</span><br />
          <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">{t.hero.title2}</span>
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">{t.hero.sub}</p>
        <div className="flex flex-col sm:flex-row gap-3 mb-20">
          <Link href="/register" className="bg-teal-600 hover:bg-teal-500 text-white px-8 py-3.5 rounded-xl font-semibold text-base transition-colors shadow-lg shadow-teal-900/40">
            {t.hero.cta1}
          </Link>
          <Link href="/docs" className="border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white px-8 py-3.5 rounded-xl font-semibold text-base transition-colors">
            {t.hero.cta2}
          </Link>
        </div>

        {/* Code block */}
        <div className="w-full max-w-2xl text-left">
          <div className="bg-gray-900/80 border border-gray-700/60 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-900">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-gray-500 text-xs ml-2">{t.code_label}</span>
            </div>
            <pre className="px-5 py-5 text-sm font-mono overflow-x-auto leading-relaxed text-gray-300">{`from openai import OpenAI

client = OpenAI(
    base_url="${origin}/v1",
    api_key="sk-gw-your-api-key",
)

response = client.chat.completions.create(
    model="gpt-5.4",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)`}</pre>
          </div>
        </div>
      </section>

      {/* Models */}
      <section className="border-t border-gray-800/60 px-6 py-14">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-sm font-semibold text-gray-500 uppercase tracking-widest mb-6">{t.models_title}</h2>
          <div className="flex flex-wrap justify-center gap-2">
            {models.map(m => (
              <div key={m.id} className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 hover:border-gray-600 transition-colors">
                <span className="text-white text-sm font-medium">{m.label}</span>
                {m.tag && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${tagColors[m.tag] || "bg-gray-800 text-gray-400 border-gray-700"}`}>
                    {m.tag}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-800/60 px-6 py-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {t.features.map(f => (
            <div key={f.title} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 hover:border-teal-800/60 hover:bg-gray-900 transition-all">
              <div className="text-2xl mb-4">{f.icon}</div>
              <h3 className="font-semibold text-white mb-2 text-base">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-gray-800/60 px-6 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl font-bold text-white mb-10">{t.how_title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {t.steps.map(s => (
              <div key={s.n} className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-teal-600 text-white font-bold text-base flex items-center justify-center mb-4 shadow-lg shadow-teal-900/40">
                  {s.n}
                </div>
                <h3 className="font-semibold text-white mb-1.5 text-sm">{s.title}</h3>
                <p className="text-gray-400 text-xs leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-800/60 px-6 py-16">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-3">{lang === "en" ? "Ready to start?" : "Sẵn sàng bắt đầu?"}</h2>
          <p className="text-gray-400 text-sm mb-8">{lang === "en" ? "Create your account and make your first API call in minutes." : "Tạo tài khoản và thực hiện lệnh gọi API đầu tiên trong vài phút."}</p>
          <Link href="/register" className="inline-block bg-teal-600 hover:bg-teal-500 text-white px-10 py-3.5 rounded-xl font-semibold text-base transition-colors shadow-lg shadow-teal-900/40">
            {t.hero.cta1}
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-800/60 px-6 py-6 flex items-center justify-between text-gray-600 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-teal-600 flex items-center justify-center text-white font-bold text-[10px]">AI</div>
          <span>AI GATEWAY</span>
        </div>
        <span>&copy; {new Date().getFullYear()} {t.footer}</span>
        <div className="flex gap-4">
          <Link href="/terms" className="hover:text-gray-400 transition-colors">Điều khoản</Link>
          <Link href="/privacy" className="hover:text-gray-400 transition-colors">Bảo mật</Link>
          <Link href="/docs" className="hover:text-gray-400 transition-colors">{t.nav.docs}</Link>
          <Link href="/login" className="hover:text-gray-400 transition-colors">{t.nav.signin}</Link>
        </div>
      </footer>
    </div>
  );
}
