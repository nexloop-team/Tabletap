"use client";

import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import { CURRENCIES, VENUE_TYPES, type CreateVenueRequest } from "@/lib/venue/schema";
import { Field, TextField } from "./ui";

const TYPE_LABELS: Record<(typeof VENUE_TYPES)[number], string> = {
  cafe: "Café",
  restaurant: "Restaurant",
  bakery: "Bakery",
  pub: "Pub",
  bar: "Bar",
  hotel: "Hotel",
  other: "Something else",
};

const SWATCHES = ["#FFFFFF", "#F6E7D8", "#EFF3EA", "#E8EEF6", "#1F2A24", "#2F4A3A", "#3B2A20", "#1C2541", "#111111"];

const STEPS = ["Your venue", "Look & feel", "The essentials", "Loyalty"];

export function OnboardingWizard({ defaultCurrency }: { defaultCurrency: (typeof CURRENCIES)[number] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [venueType, setVenueType] = useState<(typeof VENUE_TYPES)[number]>("cafe");
  const [currencyCode, setCurrency] = useState(defaultCurrency);
  const [color, setColor] = useState("#FFFFFF");
  const [tagline, setTagline] = useState<string | null>(null);
  const [menuUrl, setMenuUrl] = useState<string | null>(null);
  const [ssid, setSsid] = useState<string | null>(null);
  const [wifiPassword, setWifiPassword] = useState<string | null>(null);
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string | null>(null);
  const [loyaltyOn, setLoyaltyOn] = useState(true);
  const [rewardName, setRewardName] = useState<string | null>("Free coffee");
  const [stamps, setStamps] = useState(9);

  function validateStep(): string | null {
    if (step === 0 && !name.trim()) return "Give your venue a name";
    if (step === 2) {
      for (const [label, url] of [["Menu link", menuUrl], ["Google review link", googleReviewUrl]] as const) {
        if (url && !/^https?:\/\//i.test(url.trim())) return `${label} must start with https://`;
      }
    }
    if (step === 3 && loyaltyOn && !rewardName?.trim()) return "Name the reward guests collect stamps for";
    return null;
  }

  function next() {
    const problem = validateStep();
    setError(problem);
    if (!problem) setStep((s) => s + 1);
  }

  async function finish() {
    const problem = validateStep();
    if (problem) return setError(problem);
    setPending(true);
    setError(null);
    const body: CreateVenueRequest = {
      name: name.trim(),
      venueType,
      currencyCode,
      backgroundColorHex: color,
      tagline,
      menuUrl: menuUrl?.trim() || null,
      googleReviewUrl: googleReviewUrl?.trim() || null,
      wifi: ssid?.trim() ? { ssid: ssid.trim(), password: wifiPassword, security: wifiPassword ? "WPA2" : "open" } : null,
      loyalty: loyaltyOn && rewardName ? { rewardName: rewardName.trim(), stampsRequired: stamps } : null,
    };
    try {
      const venue = await dashboardApi.createVenue(body);
      router.replace(`/dashboard/${venue.id}?welcome=1`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <div className="wizard">
      <div className="wizard-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((label, index) => (
          <span key={label} className={index <= step ? "done" : ""} />
        ))}
      </div>

      <div className="card">
        {step === 0 && (
          <>
            <h1>Tell us about your venue</h1>
            <p>This is what guests see at the top of your page.</p>
            <TextField label="Venue name" value={name} onChange={(v) => setName(v ?? "")} placeholder="e.g. Juniper Coffee House" maxLength={80} required />
            <div className="field">
              <span className="field-label">What kind of place is it?</span>
              <div className="choice-grid">
                {VENUE_TYPES.map((type) => (
                  <button key={type} type="button" className="choice" aria-pressed={venueType === type} onClick={() => setVenueType(type)}>
                    {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
              {(venueType === "pub" || venueType === "bar") && <p className="hint">Guests will confirm they&apos;re 18+ before opting into marketing.</p>}
            </div>
            <Field label="Currency for menu prices" htmlFor="currency">
              <select id="currency" className="select" value={currencyCode} onChange={(event) => setCurrency(event.target.value as typeof currencyCode)}>
                {CURRENCIES.map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <h1>Pick your colours</h1>
            <p>Your page background. Text and cards adjust automatically to stay readable. You can add your logo and a cover photo next.</p>
            <div className="field">
              <span className="field-label">Background colour</span>
              <div className="swatches">
                {SWATCHES.map((swatch) => (
                  <button key={swatch} type="button" className="swatch" style={{ background: swatch }} aria-label={swatch} aria-pressed={color.toUpperCase() === swatch} onClick={() => setColor(swatch)} />
                ))}
                <input className="color-input" type="color" aria-label="Custom colour" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())} />
              </div>
            </div>
            <TextField label="Tagline (optional)" value={tagline} onChange={setTagline} placeholder="Slow coffee, good company" maxLength={120} />
          </>
        )}

        {step === 2 && (
          <>
            <h1>The essentials</h1>
            <p>All optional. Skip anything you don&apos;t have to hand and add it later.</p>
            <TextField
              label="Link to your menu"
              value={menuUrl}
              onChange={setMenuUrl}
              placeholder="https://"
              type="url"
              hint="Already have a menu online? Paste the link. Otherwise leave blank and build one with our menu editor."
            />
            <div className="row" style={{ marginTop: 14 }}>
              <TextField label="Wi-Fi network name" value={ssid} onChange={setSsid} placeholder="e.g. Juniper-Guest" maxLength={64} />
              <TextField label="Wi-Fi password" value={wifiPassword} onChange={setWifiPassword} placeholder="Leave blank if open" maxLength={128} />
            </div>
            <TextField
              label="Google review link"
              value={googleReviewUrl}
              onChange={setGoogleReviewUrl}
              placeholder="https://g.page/r/…/review"
              type="url"
              hint="In Google Business Profile, choose “Ask for reviews” and copy the link. Happy guests get sent here."
            />
          </>
        )}

        {step === 3 && (
          <>
            <h1>Bring guests back</h1>
            <p>A digital stamp card that lives on their phone. Included in your free Pro trial.</p>
            <div className="choice-grid" style={{ marginBottom: 16 }}>
              <button type="button" className="choice" aria-pressed={loyaltyOn} onClick={() => setLoyaltyOn(true)}>
                Yes, add a stamp card
              </button>
              <button type="button" className="choice" aria-pressed={!loyaltyOn} onClick={() => setLoyaltyOn(false)}>
                Not now
              </button>
            </div>
            {loyaltyOn && (
              <div className="row">
                <TextField label="Reward" value={rewardName} onChange={setRewardName} placeholder="Free coffee" maxLength={80} />
                <Field label="Stamps needed" htmlFor="stamps">
                  <input id="stamps" className="input" type="number" min={1} max={50} value={stamps} onChange={(event) => setStamps(Math.min(50, Math.max(1, Number(event.target.value) || 1)))} />
                </Field>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="notice notice-error" role="alert" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}

        <div className="wizard-actions">
          {step > 0 ? (
            <button type="button" className="btn" onClick={() => (setError(null), setStep((s) => s - 1))} disabled={pending}>
              <ArrowLeft aria-hidden /> Back
            </button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary" onClick={next}>
              Continue <ArrowRight aria-hidden />
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={finish} disabled={pending}>
              {pending && <Loader2 className="spin" aria-hidden />}
              {pending ? "Creating your page…" : "Create my page"}
            </button>
          )}
        </div>
      </div>
      <p className="hint" style={{ textAlign: "center", marginTop: 12 }}>
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>
    </div>
  );
}
