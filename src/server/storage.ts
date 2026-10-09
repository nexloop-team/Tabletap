import "server-only";
import fs from "node:fs";
import path from "node:path";
import { AwsClient } from "aws4fetch";
import { DATA_DIR } from "./db";

/**
 * File storage for merchant images and guests' feedback photos.
 *
 * - With S3_BUCKET set, files go to any S3-compatible store: Supabase
 *   Storage (its S3 endpoint), MinIO, Cloudflare R2, AWS S3…
 * - Otherwise they're written under DATA_DIR on this server's disk.
 *
 * Keys are paths like "media/<venue>/<file>" or "uploads/<id>.jpg", the same
 * layout on disk and in a bucket, so moving between the two is a copy.
 * Files are always served through the app (/media/… and the dashboard's
 * photo route), so the bucket can stay private.
 */

export interface Storage {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  /** Removes one file, or everything under a prefix ending in "/". */
  remove(key: string): Promise<void>;
  /** How many files sit under a prefix (capped at `max`). */
  count(prefix: string, max: number): Promise<number>;
  /** Every file under a prefix, with when it was last written (ms). */
  list(prefix: string): Promise<{ key: string; modified: number }[]>;
}

/** "uploads\\x.jpg" (older Windows saves) and "/uploads/x.jpg" → "uploads/x.jpg"; anything climbing out is refused. */
export function storageKey(raw: string): string | null {
  const key = raw.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!key || key.split("/").some((part) => part === ".." || part === "")) return null;
  return key;
}

function diskStorage(): Storage {
  const file = (key: string) => path.join(DATA_DIR, ...key.split("/"));
  return {
    async put(key, bytes) {
      fs.mkdirSync(path.dirname(file(key)), { recursive: true });
      await fs.promises.writeFile(file(key), bytes);
    },
    async get(key) {
      try {
        return await fs.promises.readFile(file(key));
      } catch {
        return null;
      }
    },
    async remove(key) {
      await fs.promises.rm(file(key.replace(/\/$/, "")), { recursive: true, force: true });
    },
    async count(prefix, max) {
      try {
        return Math.min(max, (await fs.promises.readdir(file(prefix.replace(/\/$/, "")))).length);
      } catch {
        return 0;
      }
    },
    async list(prefix) {
      const dir = prefix.replace(/\/$/, "");
      try {
        const names = await fs.promises.readdir(file(dir));
        return await Promise.all(names.map(async (name) => ({ key: `${dir}/${name}`, modified: (await fs.promises.stat(file(`${dir}/${name}`))).mtimeMs })));
      } catch {
        return [];
      }
    },
  };
}

function s3Storage(): Storage {
  const bucket = process.env.S3_BUCKET!;
  const endpoint = (process.env.S3_ENDPOINT || `https://s3.${process.env.S3_REGION || "us-east-1"}.amazonaws.com`).replace(/\/$/, "");
  const client = new AwsClient({
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    region: process.env.S3_REGION || "us-east-1",
    service: "s3",
  });
  // Path-style URLs (endpoint/bucket/key) work on every S3-compatible store.
  const url = (key = "") => `${endpoint}/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const fail = async (response: Response, action: string) => {
    throw new Error(`Storage ${action} failed: ${response.status} ${(await response.text()).slice(0, 200)}`);
  };
  async function listPage(prefix: string, max: number, token?: string) {
    const query = `list-type=2&max-keys=${max}&prefix=${encodeURIComponent(prefix)}${token ? `&continuation-token=${encodeURIComponent(token)}` : ""}`;
    const response = await client.fetch(`${url()}?${query}`);
    if (!response.ok) await fail(response, "list");
    const xml = await response.text();
    const files = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map((m) => ({
      key: /<Key>([^<]+)<\/Key>/.exec(m[1])?.[1] ?? "",
      modified: Date.parse(/<LastModified>([^<]+)<\/LastModified>/.exec(m[1])?.[1] ?? "") || 0,
    }));
    const next = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1] : undefined;
    return { files: files.filter((f) => f.key), next };
  }
  async function list(prefix: string, max: number): Promise<string[]> {
    return (await listPage(prefix, max)).files.map((f) => f.key);
  }
  return {
    async put(key, bytes, contentType) {
      const response = await client.fetch(url(key), { method: "PUT", body: new Uint8Array(bytes), headers: { "Content-Type": contentType } });
      if (!response.ok) await fail(response, "upload");
    },
    async get(key) {
      const response = await client.fetch(url(key));
      if (response.status === 404 || response.status === 400) return null;
      if (!response.ok) await fail(response, "download");
      return Buffer.from(await response.arrayBuffer());
    },
    async remove(key) {
      const keys = key.endsWith("/") ? await list(key, 1000) : [key];
      for (const k of keys) {
        const response = await client.fetch(url(k), { method: "DELETE" });
        if (!response.ok && response.status !== 404) await fail(response, "delete");
      }
    },
    async count(prefix, max) {
      return (await list(prefix, max)).length;
    },
    async list(prefix) {
      const all: { key: string; modified: number }[] = [];
      let token: string | undefined;
      do {
        const page = await listPage(prefix, 1000, token);
        all.push(...page.files);
        token = page.next;
      } while (token);
      return all;
    },
  };
}

let current: Storage | null = null;

export function storage(): Storage {
  current ??= process.env.S3_BUCKET ? s3Storage() : diskStorage();
  return current;
}
