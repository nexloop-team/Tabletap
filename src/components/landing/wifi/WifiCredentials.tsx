"use client";

import { useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/browser";
import type { MessageKey } from "@/lib/i18n";
import { wifiView } from "@/lib/venue/features";
import { useLanding } from "../LandingContext";

/** A button whose label flashes "Copied!" / "Failed" for 1.5s after a tap. */
function CopyButton({ label, value, event, disabled, primary }: { label: string; value: string; event: string; disabled?: boolean; primary?: boolean }) {
  const { t, track } = useLanding();
  const [flash, setFlash] = useState<MessageKey | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    track(event);
    let result: MessageKey = "copied";
    try {
      await copyToClipboard(value);
    } catch {
      result = "failed";
    }
    setFlash(result);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(null), 1500);
  }

  return (
    <button type="button" className={`copy-btn${primary ? " primary" : ""}`} onClick={copy} disabled={disabled} aria-label={flash ? undefined : label} aria-live="polite">
      {flash ? t(flash) : t("copy")}
    </button>
  );
}

/**
 * Behind the owner's Wi-Fi email gate the page doesn't have the password, so
 * the sheet fetches it and passes `password` here (undefined while it loads).
 */
export function WifiCredentials({ password, gated = false }: { password?: string | null; gated?: boolean }) {
  const { venue, t } = useLanding();
  const loading = gated && password === undefined;
  const wifi = wifiView(gated && venue.wifi ? { ...venue, wifi: { ...venue.wifi, password: password ?? null } } : venue);
  const securityDisplay = wifi.security || t("not_provided");
  const passwordDisplay = wifi.isOpen ? t("no_password_required") : loading ? t("loading") : wifi.password || t("not_provided");

  return (
    <>
      <div className="copy-row">
        <span className="copy-row-text">
          <span className="copy-row-label">{t("network_ssid")}</span>
          <span className="copy-row-value">{wifi.ssid}</span>
        </span>
        <CopyButton label={t("copy_ssid")} value={wifi.ssid} event="wifi_copy_ssid" />
      </div>
      <div className="copy-row">
        <span className="copy-row-text">
          <span className="copy-row-label">
            {t("password")}
            {wifi.security && ` · ${securityDisplay}`}
          </span>
          <span className={`copy-row-value${wifi.canCopyPassword ? " mono" : ""}`}>{passwordDisplay}</span>
        </span>
        {wifi.canCopyPassword && <CopyButton label={t("copy_password")} value={wifi.password} event="wifi_copy_password" primary />}
      </div>
      <p className="sheet-footnote">{wifi.isOpen ? t("wifi_open_hint") : t("wifi_password_hint")}</p>
    </>
  );
}
