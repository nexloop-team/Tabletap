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

export function logAdminAction(admin: User, action: string, target: { type: "venue" | "user"; id: string; label?: string | null }, detail?: string | null) {
  getDb()
    .prepare("INSERT INTO admin_actions (id, admin_id, admin_email, action, target_type, target_id, target_label, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(newId("adm"), admin.id, admin.email, action, target.type, target.id, target.label ?? null, detail ?? null);
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

export function listAdminActions(options: { limit?: number; target?: { type: "venue" | "user"; id: string } } = {}): AdminAction[] {
  const where = options.target ? "WHERE target_type = ? AND target_id = ?" : "";
  const params = options.target ? [options.target.type, options.target.id] : [];
  const rows = getDb()
    .prepare(`SELECT * FROM admin_actions ${where} ORDER BY created_at DESC, rowid DESC LIMIT ?`)
    .all(...params, options.limit ?? 200) as unknown as AdminActionRow[];
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
