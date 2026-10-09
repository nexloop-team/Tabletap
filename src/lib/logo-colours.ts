/**
 * The two main colours in a logo, for the bento tiles' "From your logo"
 * option. Runs in the browser: the logo is drawn small onto a canvas and its
 * pixels are bucketed by hue, weighted by how colourful they are. White,
 * black and greys are skipped unless the logo has nothing else.
 */

export interface LogoColours {
  /** The logo's strongest colour: the hero tiles. */
  main: string;
  /** A clearly different second colour, or null to use shades of the main one. */
  accent: string | null;
}

const SIZE = 64;
const BUCKETS = 24;

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function hsl(r: number, g: number, b: number) {
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

interface Bucket {
  weight: number;
  r: number;
  g: number;
  b: number;
  hue: number;
}

/** Pure part, so it can be tested without a canvas: RGBA bytes in, colours out. */
export function coloursFromPixels(data: Uint8ClampedArray | number[]): LogoColours | null {
  const buckets: Bucket[] = Array.from({ length: BUCKETS }, (_, i) => ({ weight: 0, r: 0, g: 0, b: 0, hue: (i + 0.5) * (360 / BUCKETS) }));
  const greys = { weight: 0, r: 0, g: 0, b: 0 };
  for (let i = 0; i + 3 < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 200) continue;
    const { h, s, l } = hsl(r, g, b);
    if (l > 0.94 || l < 0.04) continue;
    if (s < 0.18 || l > 0.9) {
      greys.weight += 1;
      greys.r += r;
      greys.g += g;
      greys.b += b;
      continue;
    }
    // Colourful, mid-tone pixels count most: they're the brand, not the outline or the paper.
    const weight = s * (1 - Math.abs(l - 0.45));
    const bucket = buckets[Math.floor(h / (360 / BUCKETS)) % BUCKETS];
    bucket.weight += weight;
    bucket.r += r * weight;
    bucket.g += g * weight;
    bucket.b += b * weight;
  }
  const ranked = buckets.filter((b) => b.weight > 0).sort((a, b) => b.weight - a.weight);
  const colour = (b: Bucket) => toHex(b.r / b.weight, b.g / b.weight, b.b / b.weight);
  if (ranked.length === 0) {
    if (greys.weight === 0) return null;
    return { main: toHex(greys.r / greys.weight, greys.g / greys.weight, greys.b / greys.weight), accent: null };
  }
  const main = ranked[0];
  const total = ranked.reduce((sum, b) => sum + b.weight, 0);
  // A second colour only if it's a real part of the logo and a different hue.
  const second = ranked.find((b) => {
    const gap = Math.abs(b.hue - main.hue);
    return Math.min(gap, 360 - gap) >= 40 && b.weight >= total * 0.12;
  });
  return { main: colour(main), accent: second ? colour(second) : null };
}

export async function logoColours(url: string): Promise<LogoColours | null> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, SIZE, SIZE);
  return coloursFromPixels(context.getImageData(0, 0, SIZE, SIZE).data);
}
