"use client";

import type { ReactNode } from "react";
import { PALETTES, findPalette, type Palette } from "@/lib/palettes";
import { computeTheme, tilePalette } from "@/lib/theme";
import type { VenueBranding } from "@/lib/venue/types";

/** A tiny bento page in these colours: the page, one deep tile, an accent and a soft tile. */
function Mini({ bg, hero, pop, pale }: { bg: string; hero: string; pop: string; pale: string }) {
  return (
    <span className="palette-mini" style={{ background: bg }} aria-hidden>
      <span style={{ background: hero }} />
      <span style={{ background: pop }} />
      <span style={{ background: pale }} />
    </span>
  );
}

/**
 * One choice colours the whole guest page: the background and, on the bento
 * layout, every tile. A custom colour works the tile shades out from itself.
 */
export function PalettePicker({
  branding,
  onChange,
  customInput,
}: {
  branding: VenueBranding;
  onChange: (patch: Partial<VenueBranding>) => void;
  customInput: (value: string, onChange: (hex: string) => void) => ReactNode;
}) {
  const current = findPalette(branding.palette);
  const background = branding.backgroundColorHex ?? "#FFFFFF";
  // Older saves may still hold a picked tile colour: choosing anything here clears it.
  const reset = { tileSource: null, tileColorHex: null, tileAccentHex: null };
  const pick = (palette: Palette) => onChange({ ...reset, palette: palette.id, backgroundColorHex: palette.bg });
  const custom = (hex: string) => onChange({ ...reset, palette: null, backgroundColorHex: hex });
  const derived = tilePalette({ backgroundColorHex: background }, computeTheme({ backgroundColorHex: background }).isLightCards);

  return (
    <div className="field">
      <span className="field-label">Colours</span>
      <span className="hint">Pick a palette. It sets the page and every tile, and text stays readable on each.</span>
      <div className="palette-grid" role="group" aria-label="Palettes">
        {PALETTES.map((palette) => (
          <button key={palette.id} type="button" className="palette" aria-pressed={current?.id === palette.id} onClick={() => pick(palette)}>
            <Mini {...palette} />
            <span>{palette.name}</span>
          </button>
        ))}
      </div>
      <div className="palette-custom">
        <button type="button" className="palette" aria-pressed={!current} onClick={() => custom(background)}>
          <Mini bg={background} hero={derived["--tile-hero"]} pop={derived["--tile-pop"]} pale={derived["--tile-pale"]} />
          <span>Your own colour</span>
        </button>
        <input className="color-input" type="color" aria-label="Pick your own background colour" value={background} onChange={(event) => custom(event.target.value.toUpperCase())} />
        {customInput(background, custom)}
      </div>
    </div>
  );
}
