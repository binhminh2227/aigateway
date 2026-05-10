import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow OpenAI-compatible clients (Codex CLI, VS Code Copilot, OpenAI SDK)
  // to use either base URL `https://mmo102.com` or `https://mmo102.com/v1`
  // without forcing the `/api/v1` prefix.
  async rewrites() {
    return [
      { source: "/responses",          destination: "/api/v1/responses" },
      { source: "/chat/completions",   destination: "/api/v1/chat/completions" },
      { source: "/images/generations", destination: "/api/v1/images/generations" },
      { source: "/v1/responses",          destination: "/api/v1/responses" },
      { source: "/v1/chat/completions",   destination: "/api/v1/chat/completions" },
      { source: "/v1/images/generations", destination: "/api/v1/images/generations" },
    ];
  },
};

export default nextConfig;
