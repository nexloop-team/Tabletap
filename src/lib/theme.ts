import type { LandingStyle, VenueBranding } from "./venue/types";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let clean = hex.replace(/^#/, "");
  if (clean.length === 3) clean = clean.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const n = parseInt(clean, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isLightColor(hex: string): boolean {
  return relativeLuminance(hex) > 0.45;
}

function textVars(prefix: "text" | "card-text", isLight: boolean): Record<string, string> {
  // Secondary/tertiary are alpha of the primary, never a fixed grey, so they
  // stay legible on any brand colour.
  const rgb = isLight ? "26,26,26" : "255,255,255";
  return {
    [`--${prefix}-primary`]: isLight ? "#1A1A1A" : "#FFFFFF",
    [`--${prefix}-secondary`]: `rgba(${rgb},0.7)`,
    [`--${prefix}-tertiary`]: `rgba(${rgb},0.5)`,
    // A faint wash of the text colour: announcement and social chips sit on it.
    [`--${prefix}-tint`]: `rgba(${rgb},0.08)`,
  };
}

const LIGHT_CARDS: Record<string, string> = {
  "--card-bg": "#FFFFFF",
  "--card-elevation": "0 1px 2px rgba(0,0,0,0.05), 0 6px 20px rgba(0,0,0,0.07)",
  "--icon-soft": "14%",
  "--card-shadow": "rgba(0,0,0,0.1)",
  "--card-border": "rgba(0,0,0,0.06)",
  "--input-bg": "#F2F2F7",
  "--input-border": "#D1D1D6",
  "--separator": "rgba(60,60,67,0.12)",
  "--accent-blue": "#1447E6",
  "--sudoku-accent": "#7D59D9",
  "--sudoku-on-accent": "#FFFFFF",
  "--sudoku-sel": "rgba(125,89,217,0.30)",
  "--sudoku-same": "rgba(125,89,217,0.16)",
  "--sudoku-peer": "rgba(0,0,0,0.06)",
  "--sudoku-line": "rgba(60,60,67,0.18)",
  "--sudoku-line-strong": "rgba(60,60,67,0.55)",
};

const DARK_CARDS: Record<string, string> = {
  "--card-bg": "#262626",
  "--card-elevation": "0 1px 2px rgba(0,0,0,0.3)",
  "--icon-soft": "22%",
  "--card-shadow": "rgba(0,0,0,0.1)",
  "--card-border": "rgba(255,255,255,0.15)",
  "--input-bg": "#3A3A3C",
  "--input-border": "#48484A",
  "--separator": "rgba(84,84,88,0.34)",
  "--accent-blue": "#5B8DEF",
  "--sudoku-accent": "#B79BFF",
  "--sudoku-on-accent": "#1C1C1E",
  "--sudoku-sel": "rgba(183,155,255,0.30)",
  "--sudoku-same": "rgba(183,155,255,0.16)",
  "--sudoku-peer": "rgba(255,255,255,0.07)",
  "--sudoku-line": "rgba(235,235,245,0.20)",
  "--sudoku-line-strong": "rgba(235,235,245,0.50)",
};

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase();
}

/** Black-ish or white text, whichever contrasts more with the colour. */
function textOn(hex: string): string {
  const l = relativeLuminance(hex);
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.06 ? "#FFFFFF" : "#1A1A1A";
}

/** Deep green: the grid's tile colour when the page is white, black or grey and the owner hasn't picked one. */
const DEFAULT_TILE = "#2F5D3A";

/** Where the bento tile colours come from: the logo, the page colour, or the owner's own pick. */
export function tileSource(branding: VenueBranding): "logo" | "page" | "custom" {
  // Before there was a choice, a stored tile colour meant "picked".
  return branding.tileSource ?? (hexToRgb(branding.tileColorHex?.trim() ?? "") ? "custom" : "page");
}

/** Nudge a colour's lightness until black or white text on it passes AA (4.5:1). */
function readable(hex: string, direction: "lighter" | "darker"): string {
  const { h, s, l } = rgbToHsl(hexToRgb(hex)!);
  const passes = (c: string) => {
    const lum = relativeLuminance(c);
    return Math.max(1.05 / (lum + 0.05), (lum + 0.05) / 0.06) >= 4.5;
  };
  let light = l;
  let colour = hex;
  for (let i = 0; i < 40 && !passes(colour); i++) {
    light = direction === "lighter" ? Math.min(0.95, light + 0.015) : Math.max(0.05, light - 0.015);
    colour = hslToHex(h, s, light);
  }
  return colour.toUpperCase();
}

/**
 * The bento layout's three tile shades:
 *
 * - **hero** (loyalty, Google review): the main tile colour;
 * - **pop** (Wi-Fi, stamp bars, pills, stars): a brighter shade of the main
 *   one, worked out automatically, so green gives greens;
 * - **pale** (everything else): a wash lifted off the page colour.
 *
 * The main colour comes from the logo, the owner's pick, or the page colour. Text on each is whichever of black or white reads better, and
 * a shade is nudged lighter or darker until that passes AA.
 */
export function tilePalette(branding: VenueBranding, isLightCards: boolean): Record<string, string> {
  const source = tileSource(branding);
  const pageHex = branding.backgroundColorHex?.trim() ?? "";
  const page = hexToRgb(pageHex);
  const pageHsl = page ? rgbToHsl(page) : null;
  const pageL = pageHsl?.l ?? 1;
  const darkPage = !isLightColor(page ? pageHex : "#FFFFFF");
  const floor = Math.max(pageL, 0.1);

  const picked = source !== "page" && hexToRgb(branding.tileColorHex?.trim() ?? "") ? `#${branding.tileColorHex!.trim().replace(/^#/, "").toUpperCase()}` : null;
  const base = picked ?? (pageHsl && pageHsl.s > 0.15 && pageHsl.l > 0.08 && pageHsl.l < 0.92 ? pageHex : DEFAULT_TILE);
  const { h, s, l: baseL } = rgbToHsl(hexToRgb(base)!);
  const grey = s < 0.1;
  const sat = grey ? 0 : Math.max(s, 0.35);

  // A picked colour is used as-is (only nudged for readable text), unless it would vanish into a dark page.
  const blendsIn = picked && darkPage && Math.abs(baseL - pageL) < 0.08;
  const hero = picked && !blendsIn
    ? readable(picked, baseL > 0.5 ? "lighter" : "darker")
    : darkPage
      ? hslToHex(h, Math.min(sat, 0.5), Math.min(floor + 0.16, 0.38))
      : hslToHex(h, Math.min(sat, 0.6), 0.2);

  // The second colour is always automatic: a brighter shade of the same hue, light enough for dark text.
  const pop = readable(grey ? hslToHex(85, 0.55, 0.6) : hslToHex(h, Math.min(Math.max(sat, 0.5), 0.7), 0.58), "lighter");

  const pale = isLightCards
    ? hslToHex(h, grey ? 0 : Math.min(sat, 0.4), darkPage ? 0.93 : Math.min(0.93, pageL - 0.06))
    : hslToHex(h, Math.min(sat, 0.25), darkPage ? Math.min(floor + 0.08, 0.3) : 0.17);
  return {
    "--tile-hero": hero,
    "--tile-on-hero": textOn(hero),
    "--tile-pop": pop,
    "--tile-on-pop": textOn(pop),
    "--tile-pale": pale,
    "--tile-on-pale": isLightCards ? hslToHex(h, grey ? 0 : Math.min(sat, 0.5), 0.14) : "#F2F2F2",
  };
}

export interface Theme {
  vars: Record<string, string>;
  isLightCards: boolean;
  /** The feedback accent, needed as a JS value for the card icon tint. */
  accentBlue: string;
  style: LandingStyle | null;
}

/**
 * Brand colour drives everything: an unset colour means white, never the
 * visitor's OS theme, so one venue looks the same to every customer.
 * Page text follows the real background; card chrome follows `appearance`
 * when the merchant forces it.
 */
export function computeTheme(branding: VenueBranding): Theme {
  const raw = branding.backgroundColorHex?.trim() ?? "";
  const bg = hexToRgb(raw) ? `#${raw.replace(/^#/, "")}` : "#FFFFFF";
  const isLightReal = isLightColor(bg);
  const isLightCards = branding.appearance === "light" ? true : branding.appearance === "dark" ? false : isLightReal;
  const cards = isLightCards ? LIGHT_CARDS : DARK_CARDS;
  const style = branding.style === "classic" || branding.style === "editorial" || branding.style === "modern" ? branding.style : null;
  return {
    vars: {
      "--page-bg": bg,
      "--logo-border-color": bg,
      ...textVars("text", isLightReal),
      ...textVars("card-text", isLightCards),
      ...cards,
      ...tilePalette(branding, isLightCards),
    },
    isLightCards,
    accentBlue: cards["--accent-blue"],
    style,
  };
}

/**
 * The theme as a `:root` rule, rendered into the server HTML so the first
 * paint already has the venue's colours. Every value is either a constant or
 * a colour that passed `hexToRgb`, so nothing merchant-typed reaches the CSS.
 */
export function themeCss(theme: Theme): string {
  const declarations = Object.entries(theme.vars).map(([name, value]) => `${name}:${value}`);
  return `:root{${declarations.join(";")}}`;
}

/** Google Fonts stylesheet per style preset; the default style loads nothing. */
export const STYLE_FONT_HREF: Record<LandingStyle, string> = {
  classic: "https://fonts.googleapis.com/css2?family=Playfair+Display+SC&display=swap",
  editorial: "https://fonts.googleapis.com/css2?family=Petrona:wght@400;600&display=swap",
  modern: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;600&display=swap",
};
