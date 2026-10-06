"use client";

import jsQR from "jsqr";
import { Camera, ScanLine, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/** A member card's staff code: `…/staff/stamp?c=crd_…`. */
function cardIdFromQr(text: string): string | null {
  try {
    const url = new URL(text, window.location.origin);
    const id = url.pathname === "/staff/stamp" ? url.searchParams.get("c") : null;
    return id && /^crd_[A-Za-z0-9]+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

const SCAN_WIDTH = 640;
const SCAN_EVERY_MS = 150;

/**
 * Scans a guest's card code with the device camera, right in the staff page,
 * so staff never leave it for the camera app. Opens the stamp screen for
 * the card it finds.
 */
export function ScanCardButton({ label = "Scan a card", variant = "primary" }: { label?: string; variant?: "hero" | "primary" | "secondary" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const frame = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  const close = useCallback(() => {
    stop();
    setOpen(false);
  }, [stop]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    let lastScan = 0;

    async function start() {
      setMessage("Point the camera at the guest's card code.");
      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage("This browser can't use the camera here. Use the phone's camera app, or find the guest by name below.");
        return;
      }
      try {
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelled) return media.getTracks().forEach((track) => track.stop());
        stream.current = media;
        const element = video.current!;
        element.srcObject = media;
        await element.play();
        tick();
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        setMessage(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow the camera for this site in the browser settings, then try again."
            : "We couldn't open the camera. Use the phone's camera app, or find the guest by name below.",
        );
      }
    }

    function tick() {
      frame.current = requestAnimationFrame(tick);
      const element = video.current;
      const now = performance.now();
      if (!element || !context || element.readyState < 2 || now - lastScan < SCAN_EVERY_MS) return;
      lastScan = now;
      const scale = Math.min(1, SCAN_WIDTH / element.videoWidth);
      canvas.width = Math.round(element.videoWidth * scale);
      canvas.height = Math.round(element.videoHeight * scale);
      context.drawImage(element, 0, 0, canvas.width, canvas.height);
      const found = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" });
      if (!found?.data) return;
      const cardId = cardIdFromQr(found.data);
      if (!cardId) {
        setMessage("That's not a member card code. Ask the guest to tap “Show to staff” on their card.");
        return;
      }
      navigator.vibrate?.(60);
      stop();
      setOpen(false);
      router.push(`/staff/stamp?c=${cardId}`);
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, router, stop]);

  return (
    <>
      <button type="button" className={`staff-btn staff-btn-${variant}`} onClick={() => setOpen(true)}>
        {variant === "hero" ? <ScanLine aria-hidden strokeWidth={1.7} /> : <Camera aria-hidden />}
        <span>{label}</span>
      </button>
      {open && (
        <div className="scanner" role="dialog" aria-modal="true" aria-label="Scan a card">
          <video ref={video} className="scanner-video" playsInline muted />
          <div className="scanner-frame" aria-hidden />
          <p className="scanner-message" role="status">
            {message}
          </p>
          <button type="button" className="btn scanner-close" onClick={close}>
            <X aria-hidden /> Close
          </button>
        </div>
      )}
    </>
  );
}
