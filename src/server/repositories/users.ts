import "server-only";
import { getDb } from "../db";
import { newId } from "../ids";

export interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  /** Blocked by an operator: can't sign in, and existing sessions stop working. */
  blocked: boolean;
  /** Made an admin from the console (super admins come from ADMIN_EMAILS instead). */
  adminRole: boolean;
  createdAt: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  email_verified_at: string | null;
  blocked_at: string | null;
  is_admin: number;
  created_at: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    emailVerified: !!row.email_verified_at,
    blocked: !!row.blocked_at,
    adminRole: !!row.is_admin,
    createdAt: row.created_at,
  };
}

export function findUserById(id: string): User | null {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? toUser(row) : null;
}

/** Includes the hash: only the login and password-change paths need it. */
export function findUserCredentials(email: string): { user: User; passwordHash: string } | null {
  const row = getDb().prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
  return row ? { user: toUser(row), passwordHash: row.password_hash } : null;
}

export function findPasswordHash(userId: string): string | null {
  const row = getDb().prepare("SELECT password_hash FROM users WHERE id = ?").get(userId) as { password_hash: string } | undefined;
  return row?.password_hash ?? null;
}

export function emailTaken(email: string): boolean {
  return !!getDb().prepare("SELECT 1 FROM users WHERE email = ?").get(email);
}

export function insertUser(input: { email: string; name: string; passwordHash: string }): User {
  const id = newId("usr");
  getDb().prepare("INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)").run(id, input.email, input.name, input.passwordHash);
  return findUserById(id)!;
}

export function updateUserName(userId: string, name: string) {
  getDb().prepare("UPDATE users SET name = ? WHERE id = ?").run(name, userId);
}

export function updatePasswordHash(userId: string, passwordHash: string) {
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
}

export function markEmailVerified(userId: string) {
  getDb().prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, datetime('now')) WHERE id = ?").run(userId);
}

export function setUserBlocked(userId: string, blocked: boolean) {
  getDb().prepare("UPDATE users SET blocked_at = CASE WHEN ? THEN COALESCE(blocked_at, datetime('now')) ELSE NULL END WHERE id = ?").run(blocked ? 1 : 0, userId);
}

export function setAdminRole(userId: string, admin: boolean) {
  getDb().prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(admin ? 1 : 0, userId);
}

export interface AdminUserRow extends User {
  venueCount: number;
}

export function listUsersForAdmin(limit = 200): AdminUserRow[] {
  const rows = getDb()
    .prepare(
      `SELECT u.id, u.email, u.name, u.email_verified_at, u.blocked_at, u.is_admin, u.created_at, COUNT(m.venue_id) AS venue_count
       FROM users u LEFT JOIN venue_members m ON m.user_id = u.id
       GROUP BY u.id ORDER BY u.created_at DESC LIMIT ?`,
    )
    .all(limit) as unknown as (UserRow & { venue_count: number })[];
  return rows.map((row) => ({ ...toUser(row), venueCount: row.venue_count }));
}
