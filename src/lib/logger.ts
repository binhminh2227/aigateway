type Level = "info" | "warn" | "error";

function log(level: Level, event: string, data?: Record<string, unknown>) {
  console[level](JSON.stringify({ ts: new Date().toISOString(), level, event, ...data }));
}

export const logger = {
  info: (event: string, data?: Record<string, unknown>) => log("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => log("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) => log("error", event, data),
};
