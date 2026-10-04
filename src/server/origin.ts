import "server-only";

/**
 * The public site address for links in emails sent outside a request
 * (background jobs, stamp side effects). APP_URL in production.
 */
export function appOrigin(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}
