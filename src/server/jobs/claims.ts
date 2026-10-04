import "server-only";
import { getDb } from "../db";

/** Claims a unit of background work; false means it already ran. */
export function claimJob(job: string, key: string): boolean {
  return getDb().prepare("INSERT OR IGNORE INTO job_runs (job, key) VALUES (?, ?)").run(job, key).changes === 1;
}

/** Lets a failed unit be retried on the next tick. */
export function releaseJob(job: string, key: string) {
  getDb().prepare("DELETE FROM job_runs WHERE job = ? AND key = ?").run(job, key);
}
