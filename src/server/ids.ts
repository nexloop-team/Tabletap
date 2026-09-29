import "server-only";
import { randomBytes, randomUUID } from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/** Unguessable token for links sent by email (card view, consent confirmation). */
export function newToken(): string {
  return randomBytes(24).toString("base64url");
}
