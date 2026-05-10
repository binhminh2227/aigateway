export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if ((globalThis as Record<string, unknown>).__web2mPollStarted) return;
  (globalThis as Record<string, unknown>).__web2mPollStarted = true;

  const { runWeb2mPoll } = await import("@/lib/web2m-poll");
  const { logger } = await import("@/lib/logger");
  const intervalMs = parseInt(process.env.WEB2M_POLL_INTERVAL_MS || "3000", 10);

  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const r = await runWeb2mPoll();
      if (r.matched > 0) logger.info("web2m_poll_tick", r);
    } catch (e) {
      logger.error("web2m_poll_error", { err: (e as Error).message });
    } finally {
      running = false;
    }
  }, intervalMs);
  logger.info("web2m_poll_started", { intervalMs });
}
