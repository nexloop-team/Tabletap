"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { logoColours } from "@/lib/logo-colours";
import { computeTheme, tilePalette, tileSource } from "@/lib/theme";
import type { VenueBranding } from "@/lib/venue/types";

/** Deep shades white text reads on: the main tile colour. */
const MAIN_SWATCHES: [name: string, hex: string][] = [
  ["Forest", "#1F3D2B"],
  ["Olive", "#3E4A1E"],
  ["Navy", "#1F3A5F"],
  ["Plum", "#4A2545"],
  ["Espresso", "#3B2A20"],
  ["Brick", "#8C3B26"],
  ["Charcoal", "#222222"],
];

/** Brighter colours for the Wi-Fi tile, stamp bars and stars. */
const SECOND_SWATCHES: [name: string, hex: string][] = [
  ["Lime", "#8BC34A"],
  ["Mint", "#5FBF84"],
  ["Sky", "#7FB2E5"],
  ["Lavender", "#A99BE0"],
  ["Peach", "#F2A774"],
  ["Mustard", "#E1B53B"],
  ["Rose", "#E88A9A"],
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

function ColourRow({ label, hint, value, swatches, onChange, autoLabel }: { label: string; hint: string; value: string | null; swatches: [string, string][]; onChange: (hex: string | null) => void; autoLabel?: string }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="swatches">
        {autoLabel && (
          <button type="button" className="btn btn-sm" aria-pressed={!value} onClick={() => onChange(null)}>
            {autoLabel}
          </button>
        )}
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
 * from the page colour, or picked. Picking gives a main colour and a second
 * one; leave the second on Auto for shades of the main colour.
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
      onChange({ tileSource: "logo", tileColorHex: colours.main, tileAccentHex: colours.accent });
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
            hint="The loyalty and review tiles."
            value={branding.tileColorHex ?? null}
            swatches={MAIN_SWATCHES}
            onChange={(hex) => onChange({ tileSource: "custom", tileColorHex: hex ?? MAIN_SWATCHES[0][1] })}
          />
          <ColourRow
            label="Second colour"
            hint="The Wi-Fi tile, stamp bars and stars. Auto uses brighter shades of your main colour, so green stays green."
            value={branding.tileAccentHex ?? null}
            swatches={SECOND_SWATCHES}
            autoLabel="Auto"
            onChange={(hex) => onChange({ tileSource: source === "logo" ? "logo" : "custom", tileAccentHex: hex })}
          />
        </div>
      )}
    </div>
  );
}
