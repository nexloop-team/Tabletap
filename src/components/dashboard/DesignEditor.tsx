"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { LINK_ICON_TOKENS } from "@/components/icons";
import { STYLE_FONT_HREF } from "@/lib/theme";
import { buildFeatures, wifiView, type FeatureKey } from "@/lib/venue/features";
import { LINK_LABEL_TOKENS, type VenueConfig } from "@/lib/venue/schema";
import type { PublicVenue } from "@/lib/venue/types";
import { Card, Field, ImageField, newClientId, SaveBar, Switch, SwitchRow, TextField, UpgradeHint } from "./ui";
import { useVenueDraft } from "./useVenueDraft";

const SWATCHES: [name: string, hex: string][] = [
  ["White", "#FFFFFF"],
  ["Oat", "#F6E7D8"],
  ["Sage", "#DDE6DA"],
  ["Mist", "#E8EEF6"],
  ["Blush", "#FDF2F4"],
  ["Forest", "#1F2A24"],
  ["Navy", "#1F3A5F"],
  ["Espresso", "#3B2A20"],
  ["Terracotta", "#B5523B"],
  ["Black", "#111111"],
];

const APPEARANCES = [
  { value: null, label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const PRESETS = [
  { value: null, label: "Default", font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" },
  { value: "classic", label: "Classic", font: "'Playfair Display SC', Georgia, serif" },
  { value: "editorial", label: "Editorial", font: "Petrona, Georgia, serif" },
  { value: "modern", label: "Modern", font: "Outfit, system-ui, sans-serif" },
] as const;

/** The dot colour beside each card in the order list: the same tint the guest page uses. */
const CARD_TINTS: Record<string, string> = {
  loyalty: "#D94D66",
  menu: "#FF9500",
  wifi: "#4DC778",
  sudoku: "#7D59D9",
  feedback: "#1447E6",
  google_review: "#5C6166",
};

/** Typed hex with or without "#"; only a full six-digit colour is applied. */
function HexInput({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <label className="input-prefix hex-input">
      <span aria-hidden>#</span>
      <input
        className="input"
        aria-label="Custom colour hex"
        value={text ?? value.replace(/^#/, "")}
        maxLength={7}
        spellCheck={false}
        onChange={(event) => {
          const next = event.target.value.replace(/^#/, "").toUpperCase();
          setText(next);
          if (/^[0-9A-F]{6}$/.test(next)) onChange(`#${next}`);
        }}
        onBlur={() => setText(null)}
      />
    </label>
  );
}

const LINK_LABELS: Record<(typeof LINK_LABEL_TOKENS)[number], string> = {
  view_menu: "View menu",
  view_price_list: "View price list",
  our_services: "Our services",
  book_now: "Book now",
  visit_website: "Visit website",
  order_online: "Order online",
};

const CARD_LABELS: Record<string, string> = {
  loyalty: "Stamp card",
  menu: "Menu",
  wifi: "Wi-Fi",
  sudoku: "Sudoku",
  feedback: "Suggestion box",
  google_review: "Google review button",
};

type Draft = Pick<VenueConfig, "branding" | "wifi" | "socialLinks" | "externalLinks" | "announcement">;

export function DesignEditor({
  venueId,
  shortCode,
  config,
  canUseStyles,
}: {
  venueId: string;
  shortCode: string;
  config: VenueConfig;
  canUseStyles: boolean;
}) {
  const editor = useVenueDraft<Draft>(venueId, {
    branding: config.branding,
    wifi: config.wifi ?? null,
    socialLinks: config.socialLinks,
    externalLinks: config.externalLinks,
    announcement: config.announcement ?? null,
  });
  const { draft, update } = editor;
  const branding = draft.branding;
  const setBranding = (patch: Partial<Draft["branding"]>) => update("branding", { ...branding, ...patch });
  const links = draft.externalLinks;
  const setLinks = (next: Draft["externalLinks"]) => update("externalLinks", next);
  const social = draft.socialLinks;
  const setSocial = (patch: Partial<Draft["socialLinks"]>) => update("socialLinks", { ...social, ...patch });

  // What the guest page would show with this draft, in order.
  const previewVenue = { ...config, ...draft, id: venueId, shortCode, crm: config.crm } as unknown as PublicVenue;
  const features = buildFeatures(previewVenue);
  // The same list with the two switchable cards forced on, so a hidden one keeps its row and can be switched back.
  const allFeatures = buildFeatures({ ...previewVenue, branding: { ...previewVenue.branding, sudokuEnabled: true, showGoogleReviewButton: true } } as PublicVenue);
  const wifi = wifiView(previewVenue);
  const titleHidden = typeof branding.titleOverride === "string" && branding.titleOverride !== "" && branding.titleOverride.trim() === "";

  function moveFeature(index: number, delta: number) {
    const order = [...allFeatures];
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    setBranding({ featureOrder: order.map((key) => (key === "google_review" ? "googleReview" : key)) });
  }

  function featureLabel(key: FeatureKey): string {
    if (key.startsWith("link:")) {
      const link = links.find((l) => `link:${l.id}` === key);
      return link ? `Link: ${link.labelCustom || (link.labelToken ? LINK_LABELS[link.labelToken] : link.url)}` : key;
    }
    return CARD_LABELS[key] ?? key;
  }

  function featureNote(key: FeatureKey): string {
    if (key.startsWith("link:")) {
      const link = links.find((l) => `link:${l.id}` === key);
      return `Custom link${link?.url ? ` · ${link.url.replace(/^https?:\/\//, "")}` : ""}`;
    }
    switch (key) {
      case "loyalty":
        return config.loyaltyProgram?.stampsEnabled === false ? "Expands · members club" : `Expands · ${config.loyaltyProgram?.stampsRequired ?? 10} stamps`;
      case "menu":
        return config.menus.some((menu) => menu.externalUrl) ? "Links to your menu" : "Hosted menu";
      case "wifi":
        return wifi.ssid || "Expands · Wi-Fi details";
      case "feedback":
        return "Then invites a Google review";
      case "google_review":
        return "Links to your Google page";
      case "sudoku":
        return "Expands · a quick puzzle";
      default:
        return "";
    }
  }

  /** Cards with an on/off switch right in the list. */
  function featureSwitch(key: FeatureKey): { checked: boolean; onChange: (on: boolean) => void } | null {
    if (key === "sudoku") return { checked: branding.sudokuEnabled !== false, onChange: (on) => setBranding({ sudokuEnabled: on }) };
    if (key === "google_review") return { checked: !!branding.showGoogleReviewButton, onChange: (on) => setBranding({ showGoogleReviewButton: on }) };
    return null;
  }

  return (
    <div className="editor-grid">
      <div>
        <Card title="Header" description="The top of your page: who you are at a glance.">
          <div className="row">
            <ImageField venueId={venueId} label="Logo" value={branding.logoUrl} onChange={(url) => setBranding({ logoUrl: url })} hint="Square, at least 300×300." />
            <ImageField venueId={venueId} label="Cover photo" value={branding.coverImageUrl} onChange={(url) => setBranding({ coverImageUrl: url })} hint="Landscape, about 1200×600." wide />
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <TextField
              label="Title"
              value={titleHidden ? "" : branding.titleOverride}
              onChange={(value) => setBranding({ titleOverride: value })}
              placeholder={config.name}
              maxLength={80}
              hint="Leave blank to use your venue name."
            />
            <TextField label="Tagline" value={branding.tagline} onChange={(value) => setBranding({ tagline: value })} placeholder="Slow coffee, good company" maxLength={120} />
          </div>
          <SwitchRow
            title="Hide the title"
            description="Useful when your logo already spells out the name."
            checked={titleHidden}
            onChange={(on) => setBranding({ titleOverride: on ? " " : null })}
          />
        </Card>

        <Card title="Announcement" description="A short message at the top of your page: today's special, an event, holiday hours.">
          <div className="row">
            <TextField
              label="Message"
              value={draft.announcement?.text}
              onChange={(value) => update("announcement", value ? { text: value, until: draft.announcement?.until ?? null } : null)}
              placeholder="Today's special: pumpkin spice latte"
              maxLength={160}
            />
            <Field label="Show until (optional)" htmlFor="announcement-until" hint="It disappears by itself after this day.">
              <input
                id="announcement-until"
                className="input"
                type="date"
                disabled={!draft.announcement?.text}
                value={draft.announcement?.until ?? ""}
                onChange={(event) => draft.announcement && update("announcement", { ...draft.announcement, until: event.target.value || null })}
              />
            </Field>
          </div>
        </Card>

        <Card title="Colours and style">
          {/* Lets each preset tile show its own face. */}
          {Object.values(STYLE_FONT_HREF).map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          <div className="field">
            <span className="field-label">Background colour</span>
            <div className="swatches">
              {SWATCHES.map(([name, swatch]) => (
                <button
                  key={swatch}
                  type="button"
                  className="swatch"
                  style={{ background: swatch }}
                  aria-label={name}
                  title={name}
                  aria-pressed={(branding.backgroundColorHex ?? "#FFFFFF").toUpperCase() === swatch}
                  onClick={() => setBranding({ backgroundColorHex: swatch })}
                />
              ))}
              <input
                className="color-input"
                type="color"
                aria-label="Pick a custom colour"
                value={branding.backgroundColorHex ?? "#FFFFFF"}
                onChange={(event) => setBranding({ backgroundColorHex: event.target.value.toUpperCase() })}
              />
              <HexInput value={branding.backgroundColorHex ?? "#FFFFFF"} onChange={(hex) => setBranding({ backgroundColorHex: hex })} />
            </div>
            <span className="hint">Text and buttons adjust automatically so they stay readable.</span>
          </div>

          <div className="field">
            <span className="field-label" id="appearance-label">
              Card appearance
            </span>
            <div className="segmented" role="group" aria-labelledby="appearance-label">
              {APPEARANCES.map((option) => (
                <button key={option.label} type="button" aria-pressed={(branding.appearance ?? null) === option.value} onClick={() => setBranding({ appearance: option.value })}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field-label" id="style-label">
              Typography {!canUseStyles && <span className="nav-pro">Pro</span>}
            </span>
            <div className="preset-grid" role="group" aria-labelledby="style-label">
              {PRESETS.map((preset) => (
                <button key={preset.label} type="button" className="preset" aria-pressed={(branding.style ?? null) === preset.value} onClick={() => setBranding({ style: preset.value })}>
                  <span className="preset-sample" style={{ fontFamily: preset.font }} aria-hidden>
                    Aa
                  </span>
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
          {!canUseStyles && branding.style && <UpgradeHint venueId={venueId}>Typography presets show on your live page with Pro.</UpgradeHint>}
        </Card>

        <Card title="Google reviews" description="Every guest who leaves feedback is invited to review you on Google, as Google's rules require.">
          <TextField
            label="Review link"
            value={social.google}
            onChange={(value) => setSocial({ google: value })}
            placeholder="https://g.page/r/…/review"
            type="url"
            hint="Google Business Profile → Ask for reviews → copy link."
          />
        </Card>

        <Card title="Wi-Fi" description="Guests copy the password in one tap. Leave the network name blank to hide the card.">
          <div className="row">
            <TextField
              label="Network name"
              value={draft.wifi?.ssid}
              onChange={(value) => update("wifi", value ? { ...(draft.wifi ?? {}), ssid: value } : null)}
              maxLength={64}
            />
            <TextField
              label="Password"
              value={draft.wifi?.password}
              onChange={(value) => draft.wifi && update("wifi", { ...draft.wifi, password: value, security: value ? "WPA2" : "open" })}
              maxLength={128}
              hint={draft.wifi ? undefined : "Add a network name first."}
            />
          </div>
        </Card>

        <Card title="Features" description="The order guests see them in. A card appears once it has something to show.">
          <ul className="feature-rows">
            {allFeatures.map((key, index) => {
              const toggle = featureSwitch(key);
              const on = features.includes(key);
              const tint = key.startsWith("link:") ? "#9C27B0" : (CARD_TINTS[key] ?? "#5C6166");
              return (
                <li key={key} className={`feature-row${on ? "" : " off"}`}>
                  <span className="feature-row-move">
                    <button type="button" className="btn btn-icon btn-ghost" aria-label={`Move ${featureLabel(key)} up`} disabled={index === 0} onClick={() => moveFeature(index, -1)}>
                      <ArrowUp aria-hidden />
                    </button>
                    <button type="button" className="btn btn-icon btn-ghost" aria-label={`Move ${featureLabel(key)} down`} disabled={index === allFeatures.length - 1} onClick={() => moveFeature(index, 1)}>
                      <ArrowDown aria-hidden />
                    </button>
                  </span>
                  <span className="feature-row-dot" style={{ background: `${tint}22` }} aria-hidden>
                    <span style={{ background: tint }} />
                  </span>
                  <span className="feature-row-text">
                    <strong>{featureLabel(key)}</strong>
                    <span>{featureNote(key)}</span>
                  </span>
                  {toggle && <Switch label={`Show ${featureLabel(key)}`} checked={toggle.checked} onChange={toggle.onChange} />}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card
          title="Custom links"
          description="Bookings, ordering, events, gift cards: anything with a link."
          actions={
            <button
              type="button"
              className="btn btn-sm"
              disabled={links.length >= 12}
              onClick={() => setLinks([...links, { id: newClientId("lnk"), url: "", labelCustom: "", icon: "link" }])}
            >
              <Plus aria-hidden /> Add link
            </button>
          }
        >
          {links.length === 0 ? (
            <p className="muted">No custom links yet.</p>
          ) : (
            <div className="list-editor">
              {links.map((link, index) => {
                const set = (patch: Partial<typeof link>) => setLinks(links.map((l, i) => (i === index ? { ...l, ...patch } : l)));
                return (
                  <div key={link.id} className="list-row">
                    <div className="row">
                      <TextField label="Label" value={link.labelCustom} onChange={(value) => set({ labelCustom: value, labelToken: value ? null : link.labelToken })} placeholder="Book a table" maxLength={60} />
                      <TextField label="Link" value={link.url} onChange={(value) => set({ url: value ?? "" })} placeholder="https://" type="url" />
                      <Field label="Icon" htmlFor={`icon-${link.id}`}>
                        <select id={`icon-${link.id}`} className="select" value={link.icon ?? "link"} onChange={(event) => set({ icon: event.target.value as typeof link.icon })}>
                          {LINK_ICON_TOKENS.map((icon) => (
                            <option key={icon} value={icon}>
                              {icon}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div className="spread" style={{ marginTop: 10 }}>
                      <span className="hint">{!link.labelCustom && !link.labelToken ? "Add a label so guests know where it goes." : ""}</span>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => setLinks(links.filter((_, i) => i !== index))}>
                        <Trash2 aria-hidden /> Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Social profiles" description="Shown as icons at the bottom of your page.">
          <div className="row">
            <TextField label="Instagram" value={social.instagram} onChange={(value) => setSocial({ instagram: value })} placeholder="https://instagram.com/…" type="url" />
            <TextField label="Facebook" value={social.facebook} onChange={(value) => setSocial({ facebook: value })} placeholder="https://facebook.com/…" type="url" />
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <TextField label="Tripadvisor" value={social.tripAdvisor} onChange={(value) => setSocial({ tripAdvisor: value })} placeholder="https://tripadvisor.com/…" type="url" />
            <TextField label="YouTube" value={social.youtube} onChange={(value) => setSocial({ youtube: value })} placeholder="https://youtube.com/…" type="url" />
          </div>
        </Card>
      </div>

      <aside className="preview-pane">
        <span className="preview-label">Live preview</span>
        <div className="phone">
          <div className="phone-screen">
            <iframe key={editor.version} src={`/s?i=${encodeURIComponent(shortCode)}&s=preview&embed=1`} title="Live page preview" />
          </div>
        </div>
        <p className="hint">{editor.dirty ? "Save to update the preview." : "Reloads when you save."}</p>
      </aside>

      <SaveBar dirty={editor.dirty} saving={editor.saving} error={editor.error} onSave={editor.save} onReset={editor.reset} />
    </div>
  );
}
