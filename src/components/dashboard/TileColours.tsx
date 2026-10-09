"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { logoColours } from "@/lib/logo-colours";
import { computeTheme, tilePalette, tileSource } from "@/lib/theme";
import type { VenueBranding } from "@/lib/venue/types";

/**
 * Premium main colours: one deep anchor each, the shades fine-dining and
 * café brands lean on, plus black and white for a monochrome look.
 */
const MAIN_SWATCHES: [name: string, hex: string][] = [
  ["Emerald", "#0F3D33"],
  ["Midnight", "#0F172A"],
  ["Oxblood", "#5B1A2A"],
  ["Espresso", "#2E2A26"],
  ["Olive", "#3D4127"],
  ["Deep teal", "#0E4D52"],
  ["Plum", "#3F1D38"],
  ["Terracotta", "#9A3F28"],
  ["Champagne", "#B08D3F"],
  ["Charcoal", "#1C1C1E"],
  ["Black", "#000000"],
  ["White", "#FFFFFF"],
];


type Source = "logo" | "page" | "custom";

function Strip({ branding }: { branding: VenueBranding }) {
  const palette = tilePalette(branding, computeTheme(branding).isLightCards);
  return (
    <span className="tile-strip" aria-hidden>
      <span style={{ background: palette["--tile-hero"] }} />
      <span style={{ background: palette["--tile-pop"] }} />
      <span style={{ background: palette["--tile-pale"] }} />
    </span>
  );
}

function ColourRow({ label, hint, value, swatches, onChange }: { label: string; hint: string; value: string | null; swatches: [string, string][]; onChange: (hex: string) => void }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="swatches">
        {swatches.map(([name, swatch]) => (
          <button key={swatch} type="button" className="swatch" style={{ background: swatch }} aria-label={name} title={name} aria-pressed={(value ?? "").toUpperCase() === swatch} onClick={() => onChange(swatch)} />
        ))}
        <input className="color-input" type="color" aria-label={`Pick a custom ${label.toLowerCase()}`} value={value ?? swatches[0][1]} onChange={(event) => onChange(event.target.value.toUpperCase())} />
      </div>
      <span className="hint">{hint}</span>
    </div>
  );
}

/**
 * Bento tile colours: from the logo (two colours read off it), worked out
 * from the page colour, or picked. The owner only chooses the main colour;
 * the bright and pale shades are always worked out from it.
 */
export function TileColours({ branding, onChange }: { branding: VenueBranding; onChange: (patch: Partial<VenueBranding>) => void }) {
  const source = tileSource(branding);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logo = branding.logoUrl;

  async function fromLogo() {
    if (!logo) return;
    setReading(true);
    setError(null);
    try {
      const colours = await logoColours(logo);
      if (!colours) throw new Error("no colours");
      onChange({ tileSource: "logo", tileColorHex: colours.main, tileAccentHex: null });
    } catch {
      setError("We couldn't read colours from your logo. Pick a colour instead.");
    } finally {
      setReading(false);
    }
  }

  const options: { value: Source; label: string; hint: string; preview: VenueBranding; onPick: () => void; disabled?: boolean }[] = [
    {
      value: "logo",
      label: "From your logo",
      hint: logo ? "Recommended" : "Add a logo first",
      preview: source === "logo" ? branding : { ...branding, tileSource: "page" },
      onPick: () => void fromLogo(),
      disabled: !logo || reading,
    },
    { value: "page", label: "Page colour", hint: "Worked out from it", preview: { ...branding, tileSource: "page" }, onPick: () => onChange({ tileSource: "page" }) },
    {
      value: "custom",
      label: "Pick a colour",
      hint: "Any colour you like",
      preview: source === "custom" ? branding : { ...branding, tileSource: "custom", tileColorHex: branding.tileColorHex ?? MAIN_SWATCHES[0][1], tileAccentHex: null },
      onPick: () => onChange({ tileSource: "custom", tileColorHex: branding.tileColorHex ?? MAIN_SWATCHES[0][1] }),
    },
  ];

  return (
    <div className="tile-colours">
      <span className="field-label">
        Tile colour <span className="muted">for Bento</span>
      </span>
      <p className="hint">Three shades: deep for rewards and reviews, bright for Wi-Fi, pale for the rest.</p>
      <div className="tile-colour-options" role="group" aria-label="Tile colour">
        {options.map((option) => (
          <button key={option.value} type="button" className="preset tile-colour-option" aria-pressed={source === option.value} disabled={option.disabled} onClick={option.onPick}>
            <Strip branding={option.preview} />
            <span>
              {option.label}
              <span className="preset-hint">{option.value === "logo" && reading ? <Loader2 className="spin" aria-hidden /> : option.hint}</span>
            </span>
          </button>
        ))}
      </div>
      {error && <p className="field-error">{error}</p>}
      {source !== "page" && (
        <div className="tile-colour-rows">
          <ColourRow
            label="Main colour"
            hint="The loyalty and review tiles. The Wi-Fi tile, stamp bars and stars use brighter shades of it automatically, so green stays green."
            value={branding.tileColorHex ?? null}
            swatches={MAIN_SWATCHES}
            onChange={(hex) => onChange({ tileSource: "custom", tileColorHex: hex, tileAccentHex: null })}
          />
        </div>
      )}
    </div>
  );
}
