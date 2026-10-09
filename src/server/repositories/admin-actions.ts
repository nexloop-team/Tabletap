import "server-only";
import { getDb } from "../db";
import { newId } from "../ids";
import type { User } from "./users";

/** What an operator changed, kept so every support action can be traced back to a person. */
export interface AdminAction {
  id: string;
  adminEmail: string;
  action: string;
  targetType: "venue" | "user";
  targetId: string;
  targetLabel: string | null;
  detail: string | null;
  createdAt: string;
}

export async function logAdminAction(admin: User, action: string, target: { type: "venue" | "user"; id: string; label?: string | null }, detail?: string | null) {
  (await (await getDb()).run("INSERT INTO admin_actions (id, admin_id, admin_email, action, target_type, target_id, target_label, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", newId("adm"), admin.id, admin.email, action, target.type, target.id, target.label ?? null, detail ?? null));
}

interface AdminActionRow {
  id: string;
  admin_email: string;
  action: string;
  target_type: "venue" | "user";
  target_id: string;
  target_label: string | null;
  detail: string | null;
  created_at: string;
}

export async function listAdminActions(options: { limit?: number; target?: { type: "venue" | "user"; id: string } } = {}): Promise<AdminAction[]> {
  const where = options.target ? "WHERE target_type = ? AND target_id = ?" : "";
  const params = options.target ? [options.target.type, options.target.id] : [];
  const rows = (await (await getDb()).all(`SELECT * FROM admin_actions ${where} ORDER BY created_at DESC, id DESC LIMIT ?`, ...params, options.limit ?? 200)) as unknown as AdminActionRow[];
  return rows.map((row) => ({
    id: row.id,
    adminEmail: row.admin_email,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    targetLabel: row.target_label,
    detail: row.detail,
    createdAt: row.created_at,
  }));
}

/** How long "Edit for owner" stays on before it switches itself off. */
export const EDIT_GRANT_MINUTES = 30;

export async function startEditGrant(adminId: string, venueId: string): Promise<string> {
  const expires = new Date(Date.now() + EDIT_GRANT_MINUTES * 60_000).toISOString();
  (await (await getDb()).run("INSERT INTO admin_edit_grants (admin_id, venue_id, expires_at) VALUES (?, ?, ?) ON CONFLICT (admin_id, venue_id) DO UPDATE SET expires_at = excluded.expires_at", adminId, venueId, expires));
  return expires;
}

export async function endEditGrant(adminId: string, venueId: string) {
  (await (await getDb()).run("DELETE FROM admin_edit_grants WHERE admin_id = ? AND venue_id = ?", adminId, venueId));
}

/** When this admin's edit mode for the venue ends, or null when it's off. */
export async function editGrantExpiry(adminId: string, venueId: string): Promise<string | null> {
  const row = (await (await getDb()).get("SELECT expires_at FROM admin_edit_grants WHERE admin_id = ? AND venue_id = ?", adminId, venueId)) as { expires_at: string } | undefined;
  return row && Date.parse(row.expires_at) > Date.now() ? row.expires_at : null;
}
