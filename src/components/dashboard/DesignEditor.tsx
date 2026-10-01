"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { LINK_ICON_TOKENS } from "@/components/icons";
import { buildFeatures, type FeatureKey } from "@/lib/venue/features";
import { LINK_LABEL_TOKENS, type VenueConfig } from "@/lib/venue/schema";
import type { PublicVenue } from "@/lib/venue/types";
import { Card, Field, ImageField, newClientId, SaveBar, SwitchRow, TextField, UpgradeHint } from "./ui";
import { useVenueDraft } from "./useVenueDraft";

const SWATCHES = ["#FFFFFF", "#F6E7D8", "#EFF3EA", "#E8EEF6", "#FDF2F4", "#1F2A24", "#2F4A3A", "#3B2A20", "#1C2541", "#111111"];

const LINK_LABELS: Record<(typeof LINK_LABEL_TOKENS)[number], string> = {
  view_menu: "View menu",
  view_price_list: "View price list",
  our_services: "Our services",
  book_now: "Book now",
  visit_website: "Visit website",
  order_online: "Order online",
};

const CARD_LABELS: Record<string, string> = {
  loyalty: "Loyalty card",
  menu: "Menu",
  wifi: "Wi-Fi",
  sudoku: "Sudoku",
  feedback: "Feedback box",
  google_review: "Google review",
};

type Draft = Pick<VenueConfig, "branding" | "wifi" | "socialLinks" | "externalLinks">;

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
  const titleHidden = typeof branding.titleOverride === "string" && branding.titleOverride !== "" && branding.titleOverride.trim() === "";

  function moveFeature(index: number, delta: number) {
    const order = [...features];
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

        <Card title="Colours & style">
          <div className="field">
            <span className="field-label">Background colour</span>
            <div className="swatches">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  className="swatch"
                  style={{ background: swatch }}
                  aria-label={swatch}
                  aria-pressed={(branding.backgroundColorHex ?? "#FFFFFF").toUpperCase() === swatch}
                  onClick={() => setBranding({ backgroundColorHex: swatch })}
                />
              ))}
              <input
                className="color-input"
                type="color"
                aria-label="Custom colour"
                value={branding.backgroundColorHex ?? "#FFFFFF"}
                onChange={(event) => setBranding({ backgroundColorHex: event.target.value.toUpperCase() })}
              />
            </div>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <Field label="Cards" htmlFor="appearance" hint="Auto picks light or dark cards to suit the background.">
              <select
                id="appearance"
                className="select"
                value={branding.appearance ?? ""}
                onChange={(event) => setBranding({ appearance: (event.target.value || null) as Draft["branding"]["appearance"] })}
              >
                <option value="">Auto</option>
                <option value="light">Always light</option>
                <option value="dark">Always dark</option>
              </select>
            </Field>
            <Field label={<>Typography {!canUseStyles && <span className="badge badge-pro">Pro</span>}</>} htmlFor="style">
              <select
                id="style"
                className="select"
                value={branding.style ?? ""}
                onChange={(event) => setBranding({ style: (event.target.value || null) as Draft["branding"]["style"] })}
              >
                <option value="">Standard</option>
                <option value="classic">Classic (serif capitals)</option>
                <option value="editorial">Editorial (book serif)</option>
                <option value="modern">Modern (geometric sans)</option>
              </select>
            </Field>
          </div>
          {!canUseStyles && branding.style && (
            <div style={{ marginTop: 14 }}>
              <UpgradeHint venueId={venueId}>Typography presets show on your live page with Pro.</UpgradeHint>
            </div>
          )}
        </Card>

        <Card title="Google reviews" description="Guests who leave happy feedback are invited to review you on Google.">
          <TextField
            label="Review link"
            value={social.google}
            onChange={(value) => setSocial({ google: value })}
            placeholder="https://g.page/r/…/review"
            type="url"
            hint="Google Business Profile → Ask for reviews → copy link."
          />
          <SwitchRow
            title="Show a “Leave a Google review” card"
            description="Without it, the review link is still offered after positive feedback."
            checked={!!branding.showGoogleReviewButton}
            onChange={(on) => setBranding({ showGoogleReviewButton: on })}
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

        <Card title="Cards on your page" description="Choose the order guests see them in. A card appears once it has something to show.">
          <div className="list-editor">
            {features.map((key, index) => (
              <div key={key} className="list-row">
                <div className="list-row-head">
                  <span className="grow">{featureLabel(key)}</span>
                  <button type="button" className="btn btn-icon btn-ghost" aria-label="Move up" disabled={index === 0} onClick={() => moveFeature(index, -1)}>
                    <ArrowUp aria-hidden />
                  </button>
                  <button type="button" className="btn btn-icon btn-ghost" aria-label="Move down" disabled={index === features.length - 1} onClick={() => moveFeature(index, 1)}>
                    <ArrowDown aria-hidden />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <SwitchRow
            title="Sudoku"
            description="A quick puzzle for guests waiting on their order."
            checked={branding.sudokuEnabled !== false}
            onChange={(on) => setBranding({ sudokuEnabled: on })}
          />
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
        <div className="phone">
          <iframe key={editor.version} src={`/s?i=${encodeURIComponent(shortCode)}&s=preview`} title="Live page preview" />
        </div>
        <p className="hint">{editor.dirty ? "Save to update the preview." : "Live preview of your page."}</p>
      </aside>

      <SaveBar dirty={editor.dirty} saving={editor.saving} error={editor.error} onSave={editor.save} onReset={editor.reset} />
    </div>
  );
}
