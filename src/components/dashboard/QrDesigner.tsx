"use client";

import { Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { sourceSlug } from "@/lib/qr-source";
import { PRINT_FORMATS, PrintSheets, parseTables, sheetCount, type PrintFormat, type PrintVenue } from "./PrintSheets";
import { Card, CopyButton, Field, HelpTip } from "./ui";

const COLORS = ["#000000", "#1F2A24", "#2F4A3A", "#1C2541", "#7A2E2E"];

export function QrDesigner({ venueId, guestUrl, printVenue }: { venueId: string; guestUrl: string; printVenue: PrintVenue }) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#000000");
  const [tables, setTables] = useState("1-10");
  const [format, setFormat] = useState<PrintFormat>("a6");
  const labels = useMemo(() => parseTables(tables), [tables]);
  const sheets = sheetCount(format, labels.length);
  const source = sourceSlug(label);
  const query = new URLSearchParams({ ...(source ? { s: source } : {}), color });
  const qrBase = `/api/dashboard/venues/${venueId}/qr?${query}`;
  const link = source ? `${guestUrl}&s=${source}` : guestUrl;

  return (
    <>
      <div className="qr-grid no-print">
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

          <Card id="table-cards" title="Table cards" description="Cards, stickers and signs with a numbered code per table, in your colours. Print them straight from here.">
            <div className="field">
              <span className="field-label" id="print-format-label">
                Format
              </span>
              <div className="segmented print-format-pick" role="group" aria-labelledby="print-format-label">
                {(Object.keys(PRINT_FORMATS) as PrintFormat[]).map((f) => (
                  <button key={f} type="button" aria-pressed={format === f} onClick={() => setFormat(f)}>
                    {PRINT_FORMATS[f].label}
                  </button>
                ))}
              </div>
              <p className="hint">{PRINT_FORMATS[format].hint}</p>
            </div>
            {format !== "wifi" && (
              <Field label="Tables" htmlFor="qr-tables" hint="A range like 1-12, or a list like 1, 2, 5, Patio.">
                <input id="qr-tables" className="input" value={tables} onChange={(event) => setTables(event.target.value)} maxLength={200} />
              </Field>
            )}
            <div className="inline" style={{ marginTop: 14 }}>
              <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={format !== "wifi" && labels.length === 0}>
                <Printer aria-hidden /> Print {sheets} sheet{sheets === 1 ? "" : "s"}
              </button>
              <span className="hint">A4, scale 100%</span>
            </div>
            <HelpTip question="How do I print them the right size?">
              <p>
                In the print window choose <strong>A4</strong> paper and set the scale to <strong>100%</strong> (sometimes called &ldquo;Actual size&rdquo;). Turn off &ldquo;Fit to page&rdquo;, or the codes print too small to
                scan easily. Thick card (250gsm or more) stands up best in table holders.
              </p>
            </HelpTip>
          </Card>
        </div>
      </div>
      <section className="qr-sheet-preview" aria-label="Print preview">
        <p className="preview-label no-print">
          Preview{sheets > 1 ? ` · sheet 1 of ${sheets}` : ""}
        </p>
        <PrintSheets venue={printVenue} labels={labels} color={color} format={format} />
      </section>
    </>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="btn btn-primary" onClick={() => window.print()}>
      <Printer aria-hidden /> Print
    </button>
  );
}
