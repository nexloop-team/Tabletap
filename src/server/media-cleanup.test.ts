import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// db.ts and storage.ts read DATA_DIR on load, so point it at a scratch directory first.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tapmore-media-"));
process.env.DATA_DIR = dataDir;

type M = {
  db: typeof import("./db");
  storage: typeof import("./storage");
  cleanup: typeof import("./jobs/media-cleanup");
};
let m: M;

beforeAll(async () => {
  m = { db: await import("./db"), storage: await import("./storage"), cleanup: await import("./jobs/media-cleanup") };
});

afterAll(async () => {
  await m.db.closeDb();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("media cleanup", () => {
  it("removes replaced and never-saved images, but keeps what the page or its undo uses and fresh uploads", async () => {
    const venue = "ven_cleanup1";
    const db = await m.db.getDb();
    const url = (name: string) => `/media/${venue}/${name}`;
    await db.run(
      "INSERT INTO venues (id, short_code, config, previous_config) VALUES (?, ?, ?, ?)",
      venue,
      "cleanup-cafe",
      JSON.stringify({ name: "Cleanup Cafe", branding: { logoUrl: url("img_current.png") }, menus: [{ sections: [{ items: [{ imageUrl: url("img_dish.jpg") }] }] }] }),
      JSON.stringify({ name: "Cleanup Cafe", branding: { logoUrl: url("img_previous.png") } }),
    );
    for (const name of ["img_current.png", "img_dish.jpg", "img_previous.png", "img_replaced.png", "img_justuploaded.png"]) {
      await m.storage.storage().put(`media/${venue}/${name}`, Buffer.from("x"), "image/png");
    }
    // Everything is two days old except the upload made a moment ago.
    const old = new Date(Date.now() - 2 * 86_400_000);
    for (const name of ["img_current.png", "img_dish.jpg", "img_previous.png", "img_replaced.png"]) {
      fs.utimesSync(path.join(dataDir, "media", venue, name), old, old);
    }

    expect(await m.cleanup.runMediaCleanup(new Date())).toBe(1);
    const left = (await m.storage.storage().list(`media/${venue}/`)).map((f) => f.key.split("/").pop()).sort();
    expect(left).toEqual(["img_current.png", "img_dish.jpg", "img_justuploaded.png", "img_previous.png"]);
    // Once a day: a second run the same day does nothing.
    expect(await m.cleanup.runMediaCleanup(new Date())).toBe(0);
  });
});
