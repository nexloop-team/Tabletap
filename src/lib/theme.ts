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
  };
}

const LIGHT_CARDS: Record<string, string> = {
  "--card-bg": "#FFFFFF",
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
