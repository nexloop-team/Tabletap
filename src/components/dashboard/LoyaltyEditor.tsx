"use client";

import { Plus, Trash2 } from "lucide-react";
import type { VenueConfig } from "@/lib/venue/schema";
import { Card, Field, SaveBar, SwitchRow, TextField, UpgradeHint } from "./ui";
import { useVenueDraft } from "./useVenueDraft";

type Draft = Pick<VenueConfig, "loyaltyProgram" | "crm">;
type Program = NonNullable<VenueConfig["loyaltyProgram"]>;
type Tier = NonNullable<Program["rewardTiers"]>[number];

type Mode = "off" | "stamps" | "membership";

function modeOf(program: VenueConfig["loyaltyProgram"]): Mode {
  if (!program) return "off";
  return program.stampsEnabled === false ? "membership" : "stamps";
}

/** Tiers are stored as the full ladder; the editor shows the main reward plus the ones before it. */
function earlierTiers(program: Program | null | undefined): Tier[] {
  const tiers = program?.rewardTiers ?? [];
  return tiers.length > 1 ? tiers.slice(0, -1) : [];
}

function compose(main: { rewardName: string; stampsRequired: number }, earlier: Tier[]): Program {
  const sorted = [...earlier].sort((a, b) => a.stampsRequired - b.stampsRequired);
  return { ...main, stampsEnabled: true, rewardTiers: sorted.length ? [...sorted, main] : undefined };
}

export function LoyaltyEditor({ venueId, initial, isPro, venueType }: { venueId: string; initial: Draft; isPro: boolean; venueType: string | null | undefined }) {
  const editor = useVenueDraft<Draft>(venueId, initial);
  const { draft, update } = editor;
  const program = draft.loyaltyProgram ?? null;
  const mode = modeOf(program);
  const earlier = earlierTiers(program);
  const main = { rewardName: program?.rewardName ?? "", stampsRequired: program?.stampsRequired || 9 };
  const crm = draft.crm;
  const setCrm = (patch: Partial<Draft["crm"]>) => update("crm", { ...crm, ...patch });
  const adultsOnly = venueType === "pub" || venueType === "bar";

  function setMode(next: Mode) {
    if (next === "off") update("loyaltyProgram", null);
    else if (next === "membership") update("loyaltyProgram", { rewardName: "", stampsRequired: 0, stampsEnabled: false });
    else update("loyaltyProgram", compose({ rewardName: main.rewardName || "Free coffee", stampsRequired: main.stampsRequired }, earlier));
  }

  const setMain = (patch: Partial<typeof main>) => update("loyaltyProgram", compose({ ...main, ...patch }, earlier));
  const setEarlier = (tiers: Tier[]) => update("loyaltyProgram", compose(main, tiers));

  return (
    <>
      {!isPro && <UpgradeHint venueId={venueId}>Loyalty and guest capture are Pro features. You can set them up now; they go live when you upgrade.</UpgradeHint>}

      <Card title="Loyalty programme" description="Guests join with their email and get a card on their phone. Staff stamp it at the till.">
        <div className="choice-grid">
          <button type="button" className="choice" aria-pressed={mode === "stamps"} onClick={() => setMode("stamps")}>
            Stamp card
          </button>
          <button type="button" className="choice" aria-pressed={mode === "membership"} onClick={() => setMode("membership")}>
            Members club
          </button>
          <button type="button" className="choice" aria-pressed={mode === "off"} onClick={() => setMode("off")}>
            Off
          </button>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          {mode === "stamps" && "Collect stamps, earn rewards. The classic."}
          {mode === "membership" && "No stamps: guests join a members list and you send them offers."}
          {mode === "off" && "No loyalty card on your page."}
        </p>

        {mode === "stamps" && (
          <>
            <div className="row" style={{ marginTop: 16 }}>
              <TextField label="Main reward" value={main.rewardName} onChange={(value) => setMain({ rewardName: value ?? "" })} placeholder="Free coffee" maxLength={80} />
              <Field label="Stamps needed" htmlFor="stamps-required">
                <input
                  id="stamps-required"
                  className="input"
                  type="number"
                  min={1}
                  max={50}
                  value={main.stampsRequired}
                  onChange={(event) => setMain({ stampsRequired: Math.min(50, Math.max(1, Number(event.target.value) || 1)) })}
                />
              </Field>
            </div>

            <div className="field" style={{ marginTop: 18 }}>
              <span className="field-label">Smaller rewards on the way (optional)</span>
              <div className="list-editor">
                {earlier.map((tier, index) => (
                  <div key={index} className="list-row">
                    <div className="list-row-head">
                      <input
                        className="input"
                        aria-label="Reward"
                        placeholder="Free pastry"
                        value={tier.rewardName}
                        maxLength={80}
                        onChange={(event) => setEarlier(earlier.map((t, i) => (i === index ? { ...t, rewardName: event.target.value } : t)))}
                      />
                      <input
                        className="input"
                        style={{ maxWidth: 90 }}
                        aria-label="Stamps"
                        type="number"
                        min={1}
                        max={Math.max(1, main.stampsRequired - 1)}
                        value={tier.stampsRequired}
                        onChange={(event) => setEarlier(earlier.map((t, i) => (i === index ? { ...t, stampsRequired: Math.min(50, Math.max(1, Number(event.target.value) || 1)) } : t)))}
                      />
                      <button type="button" className="btn btn-icon btn-ghost" aria-label="Remove reward" onClick={() => setEarlier(earlier.filter((_, i) => i !== index))}>
                        <Trash2 aria-hidden />
                      </button>
                    </div>
                  </div>
                ))}
                {earlier.length < 4 && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ justifySelf: "start" }}
                    onClick={() => setEarlier([...earlier, { rewardName: "", stampsRequired: Math.max(1, Math.floor(main.stampsRequired / 2)) }])}
                  >
                    <Plus aria-hidden /> Add a smaller reward
                  </button>
                )}
              </div>
              {earlier.some((tier) => tier.stampsRequired >= main.stampsRequired) && (
                <p className="field-error">Smaller rewards should need fewer stamps than the main one.</p>
              )}
            </div>
          </>
        )}
      </Card>

      <Card title="Guest capture" description="Build a list of guests you can reach again, with their permission.">
        <SwitchRow
          title="Collect guest details"
          description="The main switch for everything below."
          checked={crm.enabled}
          onChange={(on) => setCrm({ enabled: on })}
        />
        <SwitchRow
          title="Ask for marketing consent"
          description={`Join forms get an opt-in for offers by email, confirmed by a link (double opt-in). Guests confirm they're ${adultsOnly ? "18" : "13"}+.`}
          checked={crm.consentAsk}
          disabled={!crm.enabled}
          onChange={(on) => setCrm({ consentAsk: on, wifiCapture: on ? crm.wifiCapture : false })}
        />
        <SwitchRow
          title="Email for Wi-Fi"
          description="Guests enter their email to see the Wi-Fi password. Needs marketing consent on."
          checked={crm.wifiCapture}
          disabled={!crm.enabled || !crm.consentAsk}
          onChange={(on) => setCrm({ wifiCapture: on })}
        />
        <SwitchRow
          title="Offer membership after feedback"
          description="After leaving feedback, guests are invited to join (with a free stamp on stamp cards)."
          checked={crm.feedbackCapture}
          disabled={!crm.enabled}
          onChange={(on) => setCrm({ feedbackCapture: on })}
        />
        <SwitchRow
          title="Ask for birthdays"
          description="Day and month only, never the year. Great for a birthday treat."
          checked={crm.birthdayAsk}
          disabled={!crm.enabled}
          onChange={(on) => setCrm({ birthdayAsk: on })}
        />
      </Card>

      <SaveBar dirty={editor.dirty} saving={editor.saving} error={editor.error} onSave={editor.save} onReset={editor.reset} />
    </>
  );
}
