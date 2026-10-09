import "server-only";
import { getDb } from "../db";

/** Claims a unit of background work; false means it already ran. */
export async function claimJob(job: string, key: string): Promise<boolean> {
  return (await (await getDb()).run("INSERT INTO job_runs (job, key) VALUES (?, ?) ON CONFLICT DO NOTHING", job, key)).changes === 1;
}

/** Lets a failed unit be retried on the next tick. */
export async function releaseJob(job: string, key: string) {
  (await (await getDb()).run("DELETE FROM job_runs WHERE job = ? AND key = ?", job, key));
}
