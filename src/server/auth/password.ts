import "server-only";
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * scrypt from Node's standard library: memory-hard, no native dependency.
 * Parameters are stored with each hash so they can be raised later without
 * invalidating existing passwords.
 */
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

function derive(password: string, salt: Buffer, options: ScryptOptions, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keyLength, { ...options, maxmem: 64 * 1024 * 1024 }, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r: R, p: P }, KEY_LENGTH);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), { N: Number(n), r: Number(r), p: Number(p) }, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A real hash to compare against when the email is unknown, so timing doesn't reveal which accounts exist. */
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(12).toString("hex"));
  return dummyHash;
}
