/**
 * Runs once per server start. In production it first lists any settings a
 * launch still needs (see server/env-check.ts). Then it starts the
 * background job ticker (weekly owner digest, guest emails, clean-up) in the
 * Node.js runtime only; set DISABLE_JOBS=1 to run jobs from an external
 * scheduler via `POST /api/cron/run` instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV === "production") {
    const { reportProductionConfig } = await import("./server/env-check");
    reportProductionConfig();
  }
  if (process.env.DISABLE_JOBS !== "1") {
    const { startJobScheduler } = await import("./server/jobs");
    startJobScheduler();
  }
}
