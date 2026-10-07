"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import type { VenueSettings } from "@/lib/venue/settings";
import { Card, Field, SwitchRow } from "./ui";

type Automations = VenueSettings["automations"];

/** Emails that send themselves: reward ready, birthday treat, win-back. */
export function AutomationsForm({
  venueId,
  initial,
  collectsConsent,
  collectsBirthdays,
}: {
  venueId: string;
  initial: Automations;
  collectsConsent: boolean;
  collectsBirthdays: boolean;
}) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await dashboardApi.updateSettings(venueId, { automations: draft });
      setSaved(result.automations);
      setDraft(result.automations);
      setMessage({ ok: true, text: "Saved." });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Automatic emails" description="Set them once and they send themselves, so regulars keep coming back.">

      <SwitchRow
        title="“Your reward is ready”"
        description="When a stamp unlocks a reward, the guest gets a short email with their card. Sent to every member (it's about their card, not marketing)."
        checked={draft.rewardReady}
        onChange={(on) => setDraft({ ...draft, rewardReady: on })}
      />

      <SwitchRow
        title="Birthday treat"
        description={
          collectsBirthdays && collectsConsent
            ? "Three days before a guest's birthday. Only to guests who agreed to offers."
            : "Turn on “Ask for birthdays” and “Ask for marketing consent” above first, so there are birthdays to celebrate."
        }
        checked={draft.birthday.enabled}
        onChange={(on) => setDraft({ ...draft, birthday: { ...draft.birthday, enabled: on } })}
      />
      {draft.birthday.enabled && (
        <Field label="Birthday offer" htmlFor="birthday-offer" hint="Shown in the email. Guests show it at the counter.">
          <input
            id="birthday-offer"
            className="input"
            maxLength={200}
            value={draft.birthday.offer}
            onChange={(event) => setDraft({ ...draft, birthday: { ...draft.birthday, offer: event.target.value } })}
          />
        </Field>
      )}

      <SwitchRow
        title="“We miss you”"
        description={collectsConsent ? "When a regular hasn't visited for a while. Once per absence, only to guests who agreed to offers." : "Turn on “Ask for marketing consent” above first."}
        checked={draft.winBack.enabled}
        onChange={(on) => setDraft({ ...draft, winBack: { ...draft.winBack, enabled: on } })}
      />
      {draft.winBack.enabled && (
        <div className="row">
          <Field label="After" htmlFor="winback-days">
            <select
              id="winback-days"
              className="select"
              value={draft.winBack.days}
              onChange={(event) => setDraft({ ...draft, winBack: { ...draft.winBack, days: Number(event.target.value) } })}
            >
              {[14, 21, 30, 45, 60, 90].map((days) => (
                <option key={days} value={days}>
                  {days} days away
                </option>
              ))}
            </select>
          </Field>
          <Field label="Come-back offer" htmlFor="winback-offer">
            <input
              id="winback-offer"
              className="input"
              maxLength={200}
              value={draft.winBack.offer}
              onChange={(event) => setDraft({ ...draft, winBack: { ...draft.winBack, offer: event.target.value } })}
            />
          </Field>
        </div>
      )}

      <div className="inline" style={{ marginTop: 14 }}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || busy}>
          {busy && <Loader2 className="spin" aria-hidden />} Save email settings
        </button>
        {message && <span className={message.ok ? "hint" : "field-error"}>{message.text}</span>}
      </div>
    </Card>
  );
}
