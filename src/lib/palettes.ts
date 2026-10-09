/**
 * Colour palettes for the guest page. One pick sets everything: the page
 * background, and for the bento layout its three tile shades.
 *
 * Each is one family of colours in clear steps, light to deep: a tinted
 * page, near-white cards on it, a mid tone for the accent tile and a deep
 * tone for the anchor tiles (text in that deep tone on the light tiles).
 * Coffee House is the owner-supplied reference; the others follow it.
 */

export interface Palette {
  id: string;
  name: string;
  /** Page background. */
  bg: string;
  /** Deep tile: loyalty card, Google review. */
  hero: string;
  /** Accent: Wi-Fi tile, stamp bars, pills, stars. */
  pop: string;
  /** Soft tile: menu, feedback, Sudoku, links. */
  pale: string;
}

export const PALETTES: Palette[] = [
  // Cream #F5E6CA, White #FFFDF7, Beige #DCC7AA, Espresso Brown #4B3832.
  { id: "coffee-house", name: "Coffee House", bg: "#F5E6CA", hero: "#4B3832", pop: "#DCC7AA", pale: "#FFFDF7" },
  { id: "matcha", name: "Matcha", bg: "#E4E9D3", hero: "#33452B", pop: "#BFCB9B", pale: "#FBFCF5" },
  { id: "rose-clay", name: "Rose Clay", bg: "#F3DFD3", hero: "#6B3A2A", pop: "#E2B8A0", pale: "#FFFBF8" },
  { id: "stone", name: "Stone", bg: "#E8E4DD", hero: "#2E2B28", pop: "#CBC3B6", pale: "#FFFDFA" },
];

export function findPalette(id: string | null | undefined): Palette | null {
  return PALETTES.find((palette) => palette.id === id) ?? null;
}
