"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

declare global {
  interface Window {
    turnstile?: {
      render(element: HTMLElement, options: { sitekey: string; theme?: "auto" | "light" | "dark" }): string;
      reset(widgetId?: string): void;
      remove(widgetId: string): void;
    };
  }
}

/**
 * Cloudflare Turnstile, rendered explicitly so it survives client-side
 * navigation. It adds a hidden `cf-turnstile-response` field to the
 * surrounding form. Renders nothing when no site key is configured.
 */
export function Turnstile() {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!SITE_KEY || !ready || !container.current || !window.turnstile) return;
    const id = window.turnstile.render(container.current, { sitekey: SITE_KEY, theme: "auto" });
    return () => window.turnstile?.remove(id);
  }, [ready]);

  if (!SITE_KEY) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setReady(true)} />
      <div ref={container} style={{ marginTop: 16, minHeight: 65 }} />
    </>
  );
}

/** Tokens are single-use, so a failed submit needs a fresh challenge. */
export function resetTurnstile() {
  window.turnstile?.reset();
}

export function captchaToken(form: FormData): string | undefined {
  return String(form.get("cf-turnstile-response") ?? "") || undefined;
}
