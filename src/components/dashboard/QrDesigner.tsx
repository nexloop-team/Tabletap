"use client";

import { Download, Printer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { sourceSlug } from "@/lib/qr-source";
import { Card, CopyButton, Field } from "./ui";

const COLORS = ["#000000", "#1F2A24", "#2F4A3A", "#1C2541", "#7A2E2E"];

export function QrDesigner({ venueId, guestUrl }: { venueId: string; guestUrl: string }) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#000000");
  const [tables, setTables] = useState("1-10");
  const source = sourceSlug(label);
  const query = new URLSearchParams({ ...(source ? { s: source } : {}), color });
  const qrBase = `/api/dashboard/venues/${venueId}/qr?${query}`;
  const link = source ? `${guestUrl}&s=${source}` : guestUrl;

  return (
    <div className="qr-grid">
      <div className="qr-frame">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated on demand, auth-gated */}
        <img src={qrBase} alt={`QR code linking to ${link}`} />
      </div>
      <div>
        <Card title="Download a code" description="Print it on table cards, the counter, menus or the window.">
          <Field label="Where will this code go? (optional)" htmlFor="qr-label" hint={source ? `Scans will show as “${source}” in your stats.` : "Name it to see which spot gets the most scans, e.g. “Table 4” or “Window”."}>
            <input id="qr-label" className="input" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Table 4" maxLength={60} />
          </Field>
          <div className="field" style={{ marginTop: 14 }}>
            <span className="field-label">Colour</span>
            <div className="swatches">
              {COLORS.map((c) => (
                <button key={c} type="button" className="swatch" style={{ background: c }} aria-label={c} aria-pressed={color === c} onClick={() => setColor(c)} />
              ))}
              <input className="color-input" type="color" aria-label="Custom colour" value={color} onChange={(event) => setColor(event.target.value.toUpperCase())} />
            </div>
            <p className="hint">Keep it dark on white so every phone can scan it.</p>
          </div>
          <div className="share-link" style={{ marginTop: 14 }}>
            <code>{link}</code>
            <CopyButton text={link} />
          </div>
          <div className="inline" style={{ marginTop: 16 }}>
            <a className="btn btn-primary" href={`${qrBase}&format=png&size=2048&download=1`}>
              <Download aria-hidden /> PNG (print)
            </a>
            <a className="btn" href={`${qrBase}&format=svg&download=1`}>
              <Download aria-hidden /> SVG (designers)
            </a>
          </div>
        </Card>

        <Card title="Table cards" description="A printable sheet with a numbered code per table, ready to cut out.">
          <Field label="Tables" htmlFor="qr-tables" hint="A range like 1-12, or a list like 1, 2, 5, Patio.">
            <input id="qr-tables" className="input" value={tables} onChange={(event) => setTables(event.target.value)} maxLength={200} />
          </Field>
          <Link className="btn" style={{ marginTop: 14 }} href={`/dashboard/${venueId}/qr/print?${new URLSearchParams({ tables, color })}`}>
            <Printer aria-hidden /> Open print sheet
          </Link>
        </Card>
      </div>
    </div>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="btn btn-primary" onClick={() => window.print()}>
      <Printer aria-hidden /> Print
    </button>
  );
}
