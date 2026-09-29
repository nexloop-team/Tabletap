"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { copyToClipboard, getPlatform, subscribeNever, type PlatformKey } from "@/lib/browser";
import type { MessageKey } from "@/lib/i18n";
import { wifiView } from "@/lib/venue/features";
import { useLanding } from "../LandingContext";

/** A button whose label flashes "Copied!" / "Failed" for 1.5s after a tap. */
function CopyButton({ label, value, event, disabled }: { label: string; value: string; event: string; disabled?: boolean }) {
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
    <button type="button" className="sheet-btn" onClick={copy} disabled={disabled} aria-live="polite">
      {flash ? t(flash) : label}
    </button>
  );
}

const SETTINGS_HELP: Record<PlatformKey, MessageKey> = {
  mac: "mac_wifi",
  windows: "windows_wifi",
  android: "device_wifi",
  ios: "device_wifi",
  unknown: "device_wifi",
};

export function WifiCredentials() {
  const { venue, t, track, showDialog } = useLanding();
  const wifi = wifiView(venue);
  const platform = useSyncExternalStore<PlatformKey>(subscribeNever, getPlatform, () => "unknown");

  function openSettings() {
    track("wifi_settings_tapped", { device_platform: platform });
    if (platform === "android") {
      // Chrome often drops the settings intent; if we're still visible, explain instead.
      window.location.href = "intent:#Intent;action=android.settings.WIFI_SETTINGS;end";
      setTimeout(() => {
        if (!document.hidden) showDialog({ title: t("feature_wifi"), message: t("device_wifi") });
      }, 600);
      return;
    }
    if (platform === "ios") {
      window.location.href = "App-Prefs:root=WIFI";
      setTimeout(() => {
        if (!document.hidden) showDialog({ title: t("feature_wifi"), message: t("device_wifi") });
      }, 600);
      return;
    }
    showDialog({ title: t("feature_wifi"), message: t(SETTINGS_HELP[platform]) });
  }

  const securityDisplay = wifi.security || t("not_provided");
  const passwordDisplay = wifi.isOpen ? t("no_password_required") : wifi.password || t("not_provided");

  return (
    <>
      <div className="field">
        <span className="field-label">{t("network_ssid")}</span>
        <span className="field-value">{wifi.ssid}</span>
      </div>
      <div className="field">
        <span className="field-label">{t("security")}</span>
        <span className="field-value">{securityDisplay}</span>
      </div>
      <div className="field">
        <span className="field-label">{t("password")}</span>
        <span className="field-value">{passwordDisplay}</span>
      </div>
      <div className="sheet-actions">
        <CopyButton label={t("copy_ssid")} value={wifi.ssid} event="wifi_copy_ssid" />
        <CopyButton label={t("copy_password")} value={wifi.password} event="wifi_copy_password" disabled={!wifi.canCopyPassword} />
        <button type="button" className="sheet-btn" onClick={openSettings}>
          {t("open_wifi_settings")}
        </button>
      </div>
      <div className="hint-box">{wifi.isOpen ? t("wifi_open_hint") : t("wifi_password_hint")}</div>
    </>
  );
}
