import "server-only";
import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "../db";
import { ServiceError } from "../http";
import { newToken } from "../ids";
import { findUserById, type User } from "../repositories/users";

/**
 * Database sessions: the cookie holds a random token, the table holds only
 * its SHA-256, so a leaked database can't be replayed as cookies and a
 * session can be revoked by deleting its row.
 */
export const SESSION_COOKIE = "tt_session";
/** A session ends after this many days without a visit; every visit pushes the end back. */
const SESSION_DAYS = 90;
/** The cookie outlives the session so coming back extends it (browsers cap cookies at 400 days). */
const COOKIE_DAYS = 400;
const DAY_MS = 86_400_000;

function digest(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export async function createSession(userId: string) {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * DAY_MS);
  getDb().prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(digest(token), userId, expires.toISOString());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + COOKIE_DAYS * DAY_MS),
  });
}

async function sessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** The signed-in merchant, looked up once per request. */
export const currentUser = cache(async (): Promise<User | null> => {
  const token = await sessionToken();
  if (!token) return null;
  const row = getDb().prepare("SELECT user_id, expires_at FROM sessions WHERE id = ?").get(digest(token)) as
    | { user_id: string; expires_at: string }
    | undefined;
  if (!row || Date.parse(row.expires_at) <= Date.now()) return null;
  // Coming back keeps you signed in: slide the end forward, at most one write a day.
  if (Date.parse(row.expires_at) < Date.now() + (SESSION_DAYS - 1) * DAY_MS) {
    getDb().prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(new Date(Date.now() + SESSION_DAYS * DAY_MS).toISOString(), digest(token));
  }
  const user = findUserById(row.user_id);
  return user && !user.blocked ? user : null;
});

export async function destroySession() {
  const token = await sessionToken();
  if (token) getDb().prepare("DELETE FROM sessions WHERE id = ?").run(digest(token));
  (await cookies()).delete(SESSION_COOKIE);
}

/** After a password change or reset: every other device has to sign in again. */
export async function destroyOtherSessions(userId: string) {
  const token = await sessionToken();
  getDb()
    .prepare("DELETE FROM sessions WHERE user_id = ? AND id != ?")
    .run(userId, token ? digest(token) : "");
}

export function destroyAllSessions(userId: string) {
  getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

/** Server components: send anonymous visitors to the login page, then back to where they were. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) {
    const path = (await headers()).get("x-pathname");
    redirect(path && path.startsWith("/") && !path.startsWith("//") ? `/login?next=${encodeURIComponent(path)}` : "/login");
  }
  return user;
}

/** Route handlers: a JSON 401 instead of a redirect. */
export async function requireApiUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new ServiceError(401, "Please sign in again");
  return user;
}

/** Super admins are named by email in ADMIN_EMAILS, so nobody inside the app can grant or take it away. */
export function isSuperAdmin(user: User | null): boolean {
  if (!user || !user.emailVerified) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(user.email);
}

/** May use the operator console: a super admin, or someone a super admin made an admin. */
export function isAdmin(user: User | null): boolean {
  return !!user && user.emailVerified && (user.adminRole || isSuperAdmin(user));
}

export type AuthTokenPurpose = "verify_email" | "reset_password";

/** One-time link tokens (email verification, password reset); stored hashed like sessions. */
export function createAuthToken(userId: string, purpose: AuthTokenPurpose, ttlMinutes: number): string {
  const token = newToken();
  const db = getDb();
  // A new link supersedes any earlier one for the same purpose.
  db.prepare("DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?").run(userId, purpose);
  db.prepare("INSERT INTO auth_tokens (id, user_id, purpose, expires_at) VALUES (?, ?, ?, ?)").run(
    digest(token),
    userId,
    purpose,
    new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
  );
  return token;
}

/** Returns the user id once; a second use, an expired or a wrong-purpose token gives null. */
export function consumeAuthToken(token: string, purpose: AuthTokenPurpose): string | null {
  const db = getDb();
  const row = db.prepare("SELECT user_id, expires_at, used_at FROM auth_tokens WHERE id = ? AND purpose = ?").get(digest(token), purpose) as
    | { user_id: string; expires_at: string; used_at: string | null }
    | undefined;
  if (!row || row.used_at || Date.parse(row.expires_at) <= Date.now()) return null;
  const result = db.prepare("UPDATE auth_tokens SET used_at = datetime('now') WHERE id = ? AND used_at IS NULL").run(digest(token));
  return result.changes === 1 ? row.user_id : null;
}
