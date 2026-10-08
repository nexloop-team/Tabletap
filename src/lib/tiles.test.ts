import { describe, expect, it } from "vitest";
import { tileSizes } from "@/components/landing/tiles";
import { relativeLuminance, tilePalette } from "./theme";

const contrast = (a: string, b: string) => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("bento tile sizes", () => {
  it("puts loyalty across the top and the menu tall beside the next two", () => {
    expect(tileSizes(["loyalty", "menu", "wifi", "feedback", "google_review", "sudoku"])).toEqual({
      loyalty: "wide",
      menu: "tall",
      wifi: "small",
      feedback: "small",
      google_review: "small",
      sudoku: "small",
    });
  });

  it("never leaves a hole: an odd tile out takes the whole row", () => {
    expect(tileSizes(["menu", "wifi"])).toEqual({ menu: "small", wifi: "small" });
    expect(tileSizes(["menu", "wifi", "feedback", "sudoku"])).toMatchObject({ menu: "tall", sudoku: "wide" });
    expect(tileSizes(["wifi", "loyalty", "feedback"])).toEqual({ wifi: "wide", loyalty: "wide", feedback: "wide" });
  });
});

describe("tile palette", () => {
  const pages = ["#FFFFFF", "#F6E7D8", "#DDE6DA", "#1F2A24", "#1F3A5F", "#111111", "#B5523B"];

  it("keeps text readable on every shade, on every page colour", () => {
    for (const page of pages) {
      for (const light of [true, false]) {
        const p = tilePalette({ backgroundColorHex: page }, light);
        expect(contrast(p["--tile-hero"], p["--tile-on-hero"]), `${page} hero`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p["--tile-pop"], p["--tile-on-pop"]), `${page} pop`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p["--tile-pale"], p["--tile-on-pale"]), `${page} pale`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("sets the tiles apart from the page", () => {
    for (const page of pages) {
      const p = tilePalette({ backgroundColorHex: page }, relativeLuminance(page) > 0.45);
      expect(p["--tile-pale"], page).not.toBe(page.toUpperCase());
      expect(contrast(p["--tile-hero"], page), `${page} hero vs page`).toBeGreaterThan(1.3);
    }
  });

  it("uses a picked tile colour as-is", () => {
    expect(tilePalette({ backgroundColorHex: "#FFFFFF", tileColorHex: "#1F3D2B" }, true)["--tile-hero"]).toBe("#1F3D2B");
  });
});
