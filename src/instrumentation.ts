/**
 * Runs once per server start. Starts the background job ticker (weekly owner
 * digest, guest emails) in the Node.js runtime only; set DISABLE_JOBS=1 to run
 * jobs from an external scheduler via `POST /api/cron/run` instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DISABLE_JOBS !== "1") {
    const { startJobScheduler } = await import("./server/jobs");
    startJobScheduler();
  }
}
