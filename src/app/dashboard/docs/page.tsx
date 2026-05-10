"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";

interface ModelRow { id: string; object: string; owned_by: string; pricing: { input: number; output: number } }

const TXT = {
  en: {
    title: "API Documentation",
    subtitle: "OpenAI-compatible API gateway. Drop-in replacement for any OpenAI SDK.",
    onThisPage: "On this page",
    toc: {
      quickstart: "Quick Start", endpoint: "API Endpoint", models: "Available Models",
      auth: "Authentication", chat: "Chat Completions", streaming: "Streaming",
      codex: "Codex CLI Setup", claudecode: "Claude Code CLI / VSCode",
      python: "Python", nodejs: "Node.js / JS", errors: "Error Codes",
    },
    qs: {
      step1Title: "Create API Key", step1Desc: "Go to API Keys → Create API Key",
      step2Title: "Set Base URL", step2Desc: (b: string) => `Point your client to ${b}`,
      step3Title: "Make a Request", step3Desc: "Use your key as Bearer token",
      goThere: "→ Go there", testNow: "Test immediately",
    },
    ep: {
      baseUrl: "Base URL",
      desc: "This gateway is fully compatible with the OpenAI API. You can use any existing OpenAI SDK by changing only the",
      and: "and",
      tEndpoint: "Endpoint", tMethod: "Method", tDesc: "Description",
      chatDesc: "Chat completions (streaming supported)",
      modelsDesc: "List available models",
    },
    md: {
      pricingNote: "Pricing is per 1M tokens (USD). You can view real-time pricing via",
      tModel: "Model ID", tProvider: "Provider", tInput: "Input / 1M", tOutput: "Output / 1M",
      loading: "Loading models...",
    },
    auth: {
      desc1: "All requests must include your API key in the",
      desc2: "header as a Bearer token.",
      warn: "Keep your API key secret. Do not share it or commit it to public repositories.",
    },
    chat: {
      desc1: "Send a list of messages and receive a completion. Compatible with OpenAI's",
      desc2: "format.",
      reqLabel: "Request", respLabel: "Response",
    },
    stream: {
      desc1: "Add", desc2: "to receive Server-Sent Events (SSE) as the model generates tokens.",
      sseLabel: "SSE Response",
    },
    codex: {
      desc: "Configure Codex CLI to use this gateway by editing two files in your Codex config directory.",
      note: "Make sure the config.toml content is placed at the",
      noteBold: "beginning",
      noteEnd: "of the file.",
    },
    claudecode: {
      title: "Status: not yet available",
      line1: "Claude Code CLI and the VSCode Claude extension call the Anthropic Messages API (POST /v1/messages), which this gateway does not currently proxy.",
      line2: "The upstream provider also does not enable Messages dispatch on the keys this gateway uses, so direct routing would fail with a 403 permission_error.",
      line3: "Until both are enabled, please use one of the supported clients (OpenAI SDK, Codex CLI) shown above with the gpt-* models. We will update this section once Claude Code support ships.",
    },
    nodejsTitle: "Node.js / JavaScript",
    install: "Install", usage: "Usage (ESM)", streamingLabel: "Streaming",
    err: {
      tStatus: "Status", tCode: "Code", tDesc: "Description",
      e401: "API key is missing, invalid, or inactive",
      e402: "Account balance is too low — please top up",
      e429: "Daily spending limit reached for this key",
      e502: "Upstream gateway error — try again shortly",
      respFmt: "Error response format",
      errMsg: "Insufficient balance. Please top up.",
    },
  },
  vi: {
    title: "Tài liệu API",
    subtitle: "Cổng API tương thích OpenAI. Thay thế trực tiếp cho mọi SDK OpenAI.",
    onThisPage: "Trên trang này",
    toc: {
      quickstart: "Bắt đầu nhanh", endpoint: "Điểm cuối API", models: "Các Model khả dụng",
      auth: "Xác thực", chat: "Chat Completions", streaming: "Streaming",
      codex: "Cấu hình Codex CLI", claudecode: "Claude Code CLI / VSCode",
      python: "Python", nodejs: "Node.js / JS", errors: "Mã lỗi",
    },
    qs: {
      step1Title: "Tạo Khóa API", step1Desc: "Vào Khóa API → Tạo Khóa API",
      step2Title: "Đặt Base URL", step2Desc: (b: string) => `Trỏ ứng dụng của bạn tới ${b}`,
      step3Title: "Gửi yêu cầu", step3Desc: "Dùng khóa làm Bearer token",
      goThere: "→ Đi tới", testNow: "Thử ngay",
    },
    ep: {
      baseUrl: "Base URL",
      desc: "Cổng này tương thích hoàn toàn với OpenAI API. Bạn có thể dùng bất kỳ SDK OpenAI nào, chỉ cần đổi",
      and: "và",
      tEndpoint: "Điểm cuối", tMethod: "Phương thức", tDesc: "Mô tả",
      chatDesc: "Hoàn thành cuộc trò chuyện (hỗ trợ streaming)",
      modelsDesc: "Liệt kê các model khả dụng",
    },
    md: {
      pricingNote: "Giá tính trên 1 triệu token (USD). Xem giá thời gian thực qua",
      tModel: "Model ID", tProvider: "Nhà cung cấp", tInput: "Đầu vào / 1M", tOutput: "Đầu ra / 1M",
      loading: "Đang tải danh sách model...",
    },
    auth: {
      desc1: "Mọi yêu cầu phải gửi kèm khóa API trong header",
      desc2: "dưới dạng Bearer token.",
      warn: "Giữ khóa API bí mật. Không chia sẻ hay commit lên kho mã nguồn công khai.",
    },
    chat: {
      desc1: "Gửi danh sách tin nhắn và nhận phản hồi. Tương thích định dạng",
      desc2: "của OpenAI.",
      reqLabel: "Yêu cầu", respLabel: "Phản hồi",
    },
    stream: {
      desc1: "Thêm", desc2: "để nhận Server-Sent Events (SSE) khi model sinh token.",
      sseLabel: "Phản hồi SSE",
    },
    codex: {
      desc: "Cấu hình Codex CLI để sử dụng cổng này bằng cách chỉnh hai file trong thư mục config của Codex.",
      note: "Đảm bảo nội dung config.toml nằm ở",
      noteBold: "đầu",
      noteEnd: "file.",
    },
    claudecode: {
      title: "Trạng thái: chưa khả dụng",
      line1: "Claude Code CLI và plugin Claude trên VSCode gọi Anthropic Messages API (POST /v1/messages) — cổng này hiện chưa proxy endpoint đó.",
      line2: "Nhà cung cấp upstream cũng chưa mở quyền Messages dispatch cho key mà gateway đang dùng, nên gọi thẳng cũng sẽ trả 403 permission_error.",
      line3: "Trong khi chờ, vui lòng dùng OpenAI SDK hoặc Codex CLI ở phần trên với các model gpt-*. Mục này sẽ được cập nhật khi hỗ trợ Claude Code được bật.",
    },
    nodejsTitle: "Node.js / JavaScript",
    install: "Cài đặt", usage: "Sử dụng (ESM)", streamingLabel: "Streaming",
    err: {
      tStatus: "Mã HTTP", tCode: "Mã lỗi", tDesc: "Mô tả",
      e401: "Khóa API thiếu, sai hoặc đã bị tắt",
      e402: "Số dư không đủ — hãy nạp thêm",
      e429: "Đã đạt giới hạn chi tiêu hàng ngày của khóa",
      e502: "Lỗi cổng phía trên — vui lòng thử lại sau",
      respFmt: "Định dạng phản hồi lỗi",
      errMsg: "Số dư không đủ. Vui lòng nạp thêm.",
    },
  },
} as const;

function CodeBlock({ code, lang = "", label = "" }: { code: string; lang?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="rounded-xl overflow-hidden border border-gray-700/60 my-3">
      {label && (
        <div className="flex items-center justify-between bg-gray-800 px-4 py-2">
          <span className="text-gray-400 text-xs font-mono">{label}</span>
          <button onClick={copy} className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5">
            {copied ? "✓ Copied" : "📋 Copy"}
          </button>
        </div>
      )}
      {!label && (
        <div className="flex justify-end bg-gray-800 px-4 py-1.5">
          <button onClick={copy} className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5">
            {copied ? "✓ Copied" : "📋 Copy"}
          </button>
        </div>
      )}
      <pre className={`bg-gray-950 px-4 py-4 text-xs font-mono text-gray-300 overflow-x-auto leading-relaxed language-${lang}`}>{code}</pre>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12">
      <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-gray-800">{title}</h2>
      {children}
    </section>
  );
}

export default function DocsPage() {
  const { lang } = useLang();
  const t = TXT[lang === "vi" ? "vi" : "en"];
  const [models, setModels] = useState<ModelRow[]>([]);
  const [apiKey, setApiKey] = useState("YOUR_API_KEY");
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";

  useEffect(() => {
    fetch("/api/v1/models").then(r => r.json()).then(d => setModels(d.data || []));
    fetch("/api/keys").then(r => r.json()).then((keys: { key: string }[]) => {
      if (keys?.[0]?.key) setApiKey(keys[0].key);
    });
  }, []);

  const baseUrl = `${origin}/v1`;

  const tocItems = [
    { id: "quickstart", label: t.toc.quickstart },
    { id: "endpoint", label: t.toc.endpoint },
    { id: "models", label: t.toc.models },
    { id: "auth", label: t.toc.auth },
    { id: "chat", label: t.toc.chat },
    { id: "streaming", label: t.toc.streaming },
    { id: "codex", label: t.toc.codex },
    { id: "claudecode", label: t.toc.claudecode },
    { id: "python", label: t.toc.python },
    { id: "nodejs", label: t.toc.nodejs },
    { id: "errors", label: t.toc.errors },
  ];

  return (
    <div className="flex gap-8 max-w-6xl">
      <aside className="w-44 flex-shrink-0 hidden lg:block">
        <div className="sticky top-20">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">{t.onThisPage}</p>
          <nav className="space-y-1">
            {tocItems.map(it => (
              <a key={it.id} href={`#${it.id}`}
                className="block text-xs text-gray-400 hover:text-teal-400 py-1 transition-colors">
                {it.label}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-gray-400">{t.subtitle}</p>
        </div>

        <Section id="quickstart" title={t.toc.quickstart}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {[
              { step: "1", title: t.qs.step1Title, desc: t.qs.step1Desc, href: "/dashboard/api-keys" },
              { step: "2", title: t.qs.step2Title, desc: t.qs.step2Desc(baseUrl), href: null },
              { step: "3", title: t.qs.step3Title, desc: t.qs.step3Desc, href: null },
            ].map(s => (
              <div key={s.step} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="w-7 h-7 rounded-full bg-teal-600 text-white text-sm font-bold flex items-center justify-center mb-3">{s.step}</div>
                <p className="text-white text-sm font-medium mb-1">{s.title}</p>
                <p className="text-gray-400 text-xs">{s.desc}</p>
                {s.href && <a href={s.href} className="text-teal-400 text-xs mt-2 inline-block hover:underline">{t.qs.goThere}</a>}
              </div>
            ))}
          </div>
          <CodeBlock lang="bash" label={t.qs.testNow} code={`curl ${baseUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "model": "gpt-5.4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`} />
        </Section>

        <Section id="endpoint" title={t.toc.endpoint}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3 mb-3">
            <span className="text-xs font-semibold text-teal-400 bg-teal-900/30 border border-teal-800/50 px-2 py-1 rounded">{t.ep.baseUrl}</span>
            <code className="text-white font-mono text-sm">{baseUrl}</code>
          </div>
          <p className="text-gray-400 text-sm mb-3">
            {t.ep.desc} <code className="text-teal-400">base_url</code> {t.ep.and} <code className="text-teal-400">api_key</code>.
          </p>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="text-left px-4 py-3">{t.ep.tEndpoint}</th>
                  <th className="text-left px-4 py-3">{t.ep.tMethod}</th>
                  <th className="text-left px-4 py-3">{t.ep.tDesc}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {[
                  [`${baseUrl}/chat/completions`, "POST", t.ep.chatDesc],
                  [`${baseUrl}/models`, "GET", t.ep.modelsDesc],
                ].map(([ep, method, desc]) => (
                  <tr key={ep as string}>
                    <td className="px-4 py-3"><code className="text-teal-400 text-xs">{ep}</code></td>
                    <td className="px-4 py-3"><span className="text-xs bg-green-900/30 text-green-400 border border-green-800/40 px-2 py-0.5 rounded">{method}</span></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="models" title={t.toc.models}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="text-left px-4 py-3">{t.md.tModel}</th>
                  <th className="text-left px-4 py-3">{t.md.tProvider}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {models.length === 0 ? (
                  <tr><td colSpan={2} className="px-4 py-6 text-center text-gray-500 text-xs">{t.md.loading}</td></tr>
                ) : models.map(m => (
                  <tr key={m.id} className="hover:bg-gray-800/30">
                    <td className="px-4 py-3"><code className="text-teal-400 text-xs">{m.id}</code></td>
                    <td className="px-4 py-3 text-gray-400 text-xs capitalize">{m.owned_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="auth" title={t.toc.auth}>
          <p className="text-gray-400 text-sm mb-3">
            {t.auth.desc1} <code className="text-teal-400">Authorization</code> {t.auth.desc2}
          </p>
          <CodeBlock lang="bash" code={`Authorization: Bearer ${apiKey}`} />
          <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl px-4 py-3 text-yellow-400 text-xs">
            {t.auth.warn}
          </div>
        </Section>

        <Section id="chat" title={t.toc.chat}>
          <p className="text-gray-400 text-sm mb-3">
            {t.chat.desc1} <code className="text-teal-400">/v1/chat/completions</code> {t.chat.desc2}
          </p>
          <CodeBlock lang="bash" label={t.chat.reqLabel} code={`curl ${baseUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "model": "gpt-5.4",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What is 2+2?"}
    ],
    "temperature": 0.7,
    "max_tokens": 1000
  }'`} />
          <CodeBlock lang="json" label={t.chat.respLabel} code={`{
  "id": "resp_...",
  "object": "chat.completion",
  "model": "gpt-5.4",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "2 + 2 = 4."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 10,
    "total_tokens": 35
  }
}`} />
        </Section>

        <Section id="streaming" title={t.toc.streaming}>
          <p className="text-gray-400 text-sm mb-3">
            {t.stream.desc1} <code className="text-teal-400">&quot;stream&quot;: true</code> {t.stream.desc2}
          </p>
          <CodeBlock lang="bash" code={`curl ${baseUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "model": "gpt-5.4",
    "messages": [{"role": "user", "content": "Count to 5"}],
    "stream": true
  }'`} />
          <CodeBlock lang="text" label={t.stream.sseLabel} code={`data: {"choices":[{"delta":{"content":"1"}}]}
data: {"choices":[{"delta":{"content":", 2"}}]}
data: {"choices":[{"delta":{"content":", 3"}}]}
data: {"choices":[{"delta":{"finish_reason":"stop"}}],"usage":{...}}
data: [DONE]`} />
        </Section>

        <Section id="codex" title={t.toc.codex}>
          <p className="text-gray-400 text-sm mb-3">{t.codex.desc}</p>
          <div className="flex gap-2 mb-4">
            {[
              { label: "Windows", path: "%userprofile%\\.codex\\" },
              { label: "macOS/Linux", path: "~/.codex/" },
            ].map(o => (
              <div key={o.label} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs">
                <span className="text-gray-400">{o.label}: </span>
                <code className="text-teal-400">{o.path}</code>
              </div>
            ))}
          </div>
          <CodeBlock lang="toml" label="config.toml" code={`model_provider = "OpenAI"
model = "gpt-5.4"
review_model = "gpt-5.4"
model_reasoning_effort = "xhigh"
disable_response_storage = true
network_access = "enabled"
windows_wsl_setup_acknowledged = true
model_context_window = 1000000
model_auto_compact_token_limit = 900000

[model_providers.OpenAI]
name = "OpenAI"
base_url = "${origin}"
wire_api = "responses"
requires_openai_auth = true`} />
          <CodeBlock lang="json" label="auth.json" code={`{
  "OPENAI_API_KEY": "${apiKey}"
}`} />
          <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl px-4 py-3 text-blue-300 text-xs">
            {t.codex.note} <strong>{t.codex.noteBold}</strong> {t.codex.noteEnd}
          </div>
        </Section>

        <Section id="claudecode" title={t.toc.claudecode}>
          <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl px-4 py-4">
            <p className="text-yellow-300 text-sm font-semibold mb-2">⚠ {t.claudecode.title}</p>
            <p className="text-yellow-200/80 text-xs mb-2">{t.claudecode.line1}</p>
            <p className="text-yellow-200/80 text-xs mb-2">{t.claudecode.line2}</p>
            <p className="text-yellow-200/80 text-xs">{t.claudecode.line3}</p>
          </div>
        </Section>

        <Section id="python" title={t.toc.python}>
          <CodeBlock lang="bash" label={t.install} code="pip install openai" />
          <CodeBlock lang="python" label={t.usage} code={`from openai import OpenAI

client = OpenAI(
    api_key="${apiKey}",
    base_url="${baseUrl}",
)

response = client.chat.completions.create(
    model="gpt-5.4",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"},
    ],
)

print(response.choices[0].message.content)`} />
          <CodeBlock lang="python" label={t.streamingLabel} code={`stream = client.chat.completions.create(
    model="gpt-5.4",
    messages=[{"role": "user", "content": "Tell me a story"}],
    stream=True,
)

for chunk in stream:
    delta = chunk.choices[0].delta.content or ""
    print(delta, end="", flush=True)`} />
        </Section>

        <Section id="nodejs" title={t.nodejsTitle}>
          <CodeBlock lang="bash" label={t.install} code="npm install openai" />
          <CodeBlock lang="javascript" label={t.usage} code={`import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "${apiKey}",
  baseURL: "${baseUrl}",
});

const response = await client.chat.completions.create({
  model: "gpt-5.4",
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(response.choices[0].message.content);`} />
          <CodeBlock lang="javascript" label={t.streamingLabel} code={`const stream = await client.chat.completions.create({
  model: "gpt-5.4",
  messages: [{ role: "user", content: "Tell me a story" }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}`} />
        </Section>

        <Section id="errors" title={t.toc.errors}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="text-left px-4 py-3">{t.err.tStatus}</th>
                  <th className="text-left px-4 py-3">{t.err.tCode}</th>
                  <th className="text-left px-4 py-3">{t.err.tDesc}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-xs">
                {[
                  ["401", "invalid_api_key", t.err.e401],
                  ["402", "insufficient_balance", t.err.e402],
                  ["429", "daily_limit_exceeded", t.err.e429],
                  ["502", "server_error", t.err.e502],
                ].map(([status, code, desc]) => (
                  <tr key={code} className="hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <span className={`font-mono font-semibold ${status === "401" ? "text-red-400" : status === "402" ? "text-orange-400" : status === "429" ? "text-yellow-400" : "text-gray-400"}`}>{status}</span>
                    </td>
                    <td className="px-4 py-3"><code className="text-gray-300">{code}</code></td>
                    <td className="px-4 py-3 text-gray-400">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CodeBlock lang="json" label={t.err.respFmt} code={`{
  "error": {
    "message": "${t.err.errMsg}",
    "type": "billing_error",
    "code": "insufficient_balance"
  }
}`} />
        </Section>
      </div>
    </div>
  );
}
