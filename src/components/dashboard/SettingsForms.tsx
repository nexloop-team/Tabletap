"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import { CURRENCIES, VENUE_TYPES, type VenueConfig } from "@/lib/venue/schema";
import { useConfirm } from "./confirm";
import { Card, Field, SaveBar, SwitchRow, TextField } from "./ui";
import { useVenueDraft } from "./useVenueDraft";

type Basics = Pick<VenueConfig, "name" | "venueType" | "currencyCode">;

export function VenueBasicsForm({ venueId, initial }: { venueId: string; initial: Basics }) {
  const editor = useVenueDraft<Basics>(venueId, initial);
  const { draft, update } = editor;
  return (
    <Card title="Venue details">
      <TextField label="Venue name" value={draft.name} onChange={(value) => update("name", value ?? "")} maxLength={80} />
      <div className="row" style={{ marginTop: 14 }}>
        <Field label="Type of venue" htmlFor="venue-type" hint="Pubs and bars ask guests to confirm they're 18+ for marketing.">
          <select id="venue-type" className="select" value={draft.venueType ?? "other"} onChange={(event) => update("venueType", event.target.value as Basics["venueType"])}>
            {VENUE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Currency" htmlFor="currency">
          <select id="currency" className="select" value={draft.currencyCode} onChange={(event) => update("currencyCode", event.target.value as Basics["currencyCode"])}>
            {CURRENCIES.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </Field>
      </div>
      <SaveBar dirty={editor.dirty} saving={editor.saving} error={editor.error} onSave={editor.save} onReset={editor.reset} />
    </Card>
  );
}

function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  async function run(fn: () => Promise<string | void>) {
    setPending(true);
    setError(null);
    setDone(null);
    try {
      const message = await fn();
      if (message) setDone(message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }
  return { pending, error, done, run };
}

function Status({ error, done }: { error: string | null; done: string | null }) {
  if (error) return <p className="field-error" style={{ marginTop: 10 }}>{error}</p>;
  if (done) return <p className="hint" style={{ marginTop: 10, color: "var(--a-ok)" }}>{done}</p>;
  return null;
}

export function ShortCodeForm({ venueId, shortCode, origin }: { venueId: string; shortCode: string; origin: string }) {
  const router = useRouter();
  const [value, setValue] = useState(shortCode);
  const action = useAction();
  const ask = useConfirm();
  const changed = value.trim().toLowerCase() !== shortCode;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!(await ask({ title: "Change your page address?", body: "Every QR code you've already printed stops working. You'll need to print new ones.", confirmLabel: "Change address", danger: true }))) return;
    void action.run(async () => {
      await dashboardApi.updateVenue(venueId, { shortCode: value.trim().toLowerCase() });
      router.refresh();
      return "Saved. Download and print your new QR codes.";
    });
  }

  return (
    <Card title="Page address" description="The code inside your QR codes and links.">
      <form onSubmit={submit}>
        <div className="input-prefix">
          <span>{origin.replace(/^https?:\/\//, "")}/s?i=</span>
          <input className="input" aria-label="Venue code" value={value} onChange={(event) => setValue(event.target.value)} maxLength={40} />
        </div>
        <p className="hint" style={{ marginTop: 6 }}>Lower-case letters, numbers and hyphens. Changing it breaks printed codes.</p>
        <button className="btn" type="submit" style={{ marginTop: 12 }} disabled={!changed || action.pending}>
          {action.pending && <Loader2 className="spin" aria-hidden />} Change address
        </button>
        <Status error={action.error} done={action.done} />
      </form>
    </Card>
  );
}

export function DeleteVenueForm({ venueId, name }: { venueId: string; name: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const action = useAction();
  return (
    <Card title="Delete this venue" description="Removes the page, menus, guests, feedback and photos for good. Printed QR codes stop working." className="danger-zone">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void action.run(async () => {
            await dashboardApi.deleteVenue(venueId, confirm);
            router.replace("/dashboard");
            router.refresh();
          });
        }}
      >
        <Field label={<>Type <strong>{name}</strong> to confirm</>} htmlFor="confirm-delete">
          <input id="confirm-delete" className="input" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="off" />
        </Field>
        <button className="btn btn-danger" type="submit" style={{ marginTop: 12 }} disabled={confirm.trim() !== name.trim() || action.pending}>
          Delete venue
        </button>
        <Status error={action.error} done={null} />
      </form>
    </Card>
  );
}

/** One switch per venue for the Monday digest; saves as soon as it's flipped. */
export function DigestSwitches({ venues }: { venues: { id: string; name: string; enabled: boolean }[] }) {
  const [state, setState] = useState(() => Object.fromEntries(venues.map((venue) => [venue.id, venue.enabled])));
  const [error, setError] = useState<string | null>(null);
  if (venues.length === 0) return null;
  return (
    <Card title="Email notifications" description="A short email every Monday morning with last week's scans, guests, stamps and feedback.">
      {venues.map((venue) => (
        <SwitchRow
          key={venue.id}
          title={`Weekly summary for ${venue.name}`}
          checked={state[venue.id]}
          onChange={async (on) => {
            setState((s) => ({ ...s, [venue.id]: on }));
            setError(null);
            try {
              await dashboardApi.setNotifications({ venueId: venue.id, weeklyDigest: on });
            } catch (err) {
              setState((s) => ({ ...s, [venue.id]: !on }));
              setError(errorMessage(err));
            }
          }}
        />
      ))}
      <Status error={error} done={null} />
    </Card>
  );
}

export function AccountForms({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const profile = useAction();
  const password = useAction();
  const removal = useAction();
  const ask = useConfirm();
  const [displayName, setDisplayName] = useState(name);

  return (
    <>
      <Card title="Profile">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void profile.run(async () => {
              await dashboardApi.updateAccount({ name: displayName });
              router.refresh();
              return "Saved.";
            });
          }}
        >
          <div className="row">
            <Field label="Name" htmlFor="account-name">
              <input id="account-name" className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} required />
            </Field>
            <Field label="Email" htmlFor="account-email" hint="Contact us to change your sign-in email.">
              <input id="account-email" className="input" value={email} disabled />
            </Field>
          </div>
          <button className="btn" type="submit" style={{ marginTop: 12 }} disabled={profile.pending || displayName.trim() === name}>
            Save
          </button>
          <Status error={profile.error} done={profile.done} />
        </form>
      </Card>

      <Card title="Password">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const target = event.currentTarget;
            void password.run(async () => {
              if (form.get("new") !== form.get("confirm")) throw new Error("The new passwords don't match");
              await dashboardApi.changePassword({ currentPassword: String(form.get("current")), newPassword: String(form.get("new")) });
              target.reset();
              return "Password changed. Other devices have been signed out.";
            });
          }}
        >
          <Field label="Current password" htmlFor="pw-current">
            <input id="pw-current" name="current" className="input" type="password" autoComplete="current-password" required />
          </Field>
          <div className="row" style={{ marginTop: 14 }}>
            <Field label="New password" htmlFor="pw-new" hint="At least 8 characters.">
              <input id="pw-new" name="new" className="input" type="password" autoComplete="new-password" minLength={8} required />
            </Field>
            <Field label="Confirm new password" htmlFor="pw-confirm">
              <input id="pw-confirm" name="confirm" className="input" type="password" autoComplete="new-password" minLength={8} required />
            </Field>
          </div>
          <button className="btn" type="submit" style={{ marginTop: 12 }} disabled={password.pending}>
            Change password
          </button>
          <Status error={password.error} done={password.done} />
        </form>
      </Card>

      <Card title="Delete account" description="Deletes your account and every venue you own alone, with all of their guest data. This can't be undone." className="danger-zone">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            if (!(await ask({ title: "Delete your account?", body: "Your account and every venue you own alone are deleted for good, with all their guest data.", confirmLabel: "Delete account", danger: true }))) return;
            void removal.run(async () => {
              await dashboardApi.deleteAccount({ password: String(form.get("password")) });
              router.replace("/");
              router.refresh();
            });
          }}
        >
          <Field label="Your password" htmlFor="delete-password">
            <input id="delete-password" name="password" className="input" type="password" autoComplete="current-password" required />
          </Field>
          <button className="btn btn-danger" type="submit" style={{ marginTop: 12 }} disabled={removal.pending}>
            Delete my account
          </button>
          <Status error={removal.error} done={null} />
        </form>
      </Card>
    </>
  );
}
