import { describe, expect, it } from "vitest";
import { tileSizes } from "@/components/landing/tiles";
import { coloursFromPixels } from "./logo-colours";
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

describe("automatic second tile colour", () => {
  const hue = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    if (!d) return 0;
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return h * 60;
  };

  it("defaults to brighter shades of the main colour, so green stays green", () => {
    const p = tilePalette({ backgroundColorHex: "#FFFFFF", tileSource: "custom", tileColorHex: "#1F3D2B" }, true);
    expect(Math.abs(hue(p["--tile-pop"]) - hue("#1F3D2B"))).toBeLessThan(12);
    expect(relativeLuminance(p["--tile-pop"])).toBeGreaterThan(relativeLuminance(p["--tile-hero"]));
  });

  it("works the second colour out itself, ignoring any stored one", () => {
    const picked = tilePalette({ backgroundColorHex: "#FFFFFF", tileSource: "custom", tileColorHex: "#4A2545", tileAccentHex: "#E1B53B" }, true);
    expect(picked).toEqual(tilePalette({ backgroundColorHex: "#FFFFFF", tileSource: "custom", tileColorHex: "#4A2545" }, true));
    for (const main of ["#1F3D2B", "#1F3A5F", "#8C3B26", "#C8803F", "#222222"]) {
      const p = tilePalette({ backgroundColorHex: "#FFFFFF", tileSource: "custom", tileColorHex: main }, true);
      expect(contrast(p["--tile-pop"], p["--tile-on-pop"]), main).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps a light main colour (like copper) readable instead of forcing it dark", () => {
    const p = tilePalette({ backgroundColorHex: "#1F2A24", tileSource: "logo", tileColorHex: "#C8803F", tileAccentHex: "#F3E4CC" }, false);
    expect(contrast(p["--tile-hero"], p["--tile-on-hero"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p["--tile-pop"], p["--tile-on-pop"])).toBeGreaterThanOrEqual(4.5);
  });

  it("ignores stored colours when the owner switches back to the page colour", () => {
    const page = tilePalette({ backgroundColorHex: "#DDE6DA", tileSource: "page", tileColorHex: "#4A2545" }, true);
    expect(page).toEqual(tilePalette({ backgroundColorHex: "#DDE6DA" }, true));
  });
});

describe("logo colours", () => {
  const pixels = (...colours: [number, number, number, number][]) => colours.flatMap(([r, g, b, n]) => Array.from({ length: n }, () => [r, g, b, 255]).flat());

  it("finds the main colour and a different second one, skipping white and black", () => {
    const result = coloursFromPixels(pixels([255, 255, 255, 900], [0, 0, 0, 200], [34, 120, 60, 500], [240, 150, 40, 200]));
    expect(result?.main).toBe("#22783C");
    expect(result?.accent).toBe("#F09628");
  });

  it("leaves the second colour to shades when the logo is one hue", () => {
    expect(coloursFromPixels(pixels([34, 120, 60, 500], [60, 160, 90, 300]))?.accent).toBeNull();
  });

  it("falls back to grey for a black-and-white logo", () => {
    expect(coloursFromPixels(pixels([255, 255, 255, 500], [90, 90, 90, 300]))).toEqual({ main: "#5A5A5A", accent: null });
  });
});
