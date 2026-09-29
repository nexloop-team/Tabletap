"use client";

import { Camera, ImageIcon, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { compressImage, getPlatform, subscribeNever } from "@/lib/browser";
import { useLanding } from "../LandingContext";

export interface AttachedPhoto {
  base64: string;
  dataUrl: string;
}

/** Material-style bottom sheet offering camera or gallery (non-iOS; iOS has its own native sheet). */
function PhotoSourceSheet({ open, onClose, onCamera, onGallery }: { open: boolean; onClose: () => void; onCamera: () => void; onGallery: () => void }) {
  const { t } = useLanding();
  const firstItem = useRef<HTMLButtonElement>(null);
  // The sheet lives on <body>, which only exists in the browser.
  const inBrowser = useSyncExternalStore(subscribeNever, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstItem.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!inBrowser) return null;
  return createPortal(
    <div className={`bottom-sheet${open ? " open" : ""}`} aria-hidden={!open} inert={!open}>
      <div className="bottom-sheet-scrim" onClick={onClose} />
      <div className="bottom-sheet-panel" role="dialog" aria-modal="true" aria-label={t("add_photo")}>
        <div className="bottom-sheet-handle" aria-hidden />
        <button ref={firstItem} type="button" className="bottom-sheet-item" onClick={onCamera}>
          <Camera strokeWidth={1.6} aria-hidden />
          <span>{t("take_photo")}</span>
        </button>
        <button type="button" className="bottom-sheet-item" onClick={onGallery}>
          <ImageIcon strokeWidth={1.6} aria-hidden />
          <span>{t("choose_from_gallery")}</span>
        </button>
      </div>
    </div>,
    document.body,
  );
}

/**
 * One optional photo. The file inputs sit off-screen rather than hidden
 * because iOS Safari needs a real layout box to open the camera.
 */
export function PhotoAttach({ photo, onChange }: { photo: AttachedPhoto | null; onChange: (photo: AttachedPhoto | null) => void }) {
  const { t, track, showDialog } = useLanding();
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      onChange(await compressImage(file));
    } catch {
      showDialog({ message: t("photo_failed") });
    }
  }

  function openPicker() {
    if (getPlatform() === "ios") {
      track("photo_attach_tapped", { has_existing_photo: !!photo, picker: "ios_native" });
      libraryInput.current?.click();
      return;
    }
    track("photo_attach_tapped", { has_existing_photo: !!photo, picker: "bottom_sheet" });
    setSheetOpen(true);
  }

  function remove() {
    onChange(null);
    if (cameraInput.current) cameraInput.current.value = "";
    if (libraryInput.current) libraryInput.current.value = "";
    track("photo_removed");
  }

  return (
    <>
      {photo ? (
        <div className="photo-preview">
          {/* eslint-disable-next-line @next/next/no-img-element -- local data: URL preview */}
          <img src={photo.dataUrl} alt="" />
          <button type="button" className="photo-remove" aria-label={t("remove_photo")} onClick={remove}>
            <X strokeWidth={2} aria-hidden />
          </button>
        </div>
      ) : (
        <button type="button" className="photo-trigger" onClick={openPicker}>
          <Camera strokeWidth={1.8} aria-hidden />
          {t("add_photo")}
        </button>
      )}
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="photo-hidden-input" tabIndex={-1} aria-hidden onChange={(e) => handleFile(e.target.files?.[0])} />
      <input ref={libraryInput} type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp" className="photo-hidden-input" tabIndex={-1} aria-hidden onChange={(e) => handleFile(e.target.files?.[0])} />
      <PhotoSourceSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCamera={() => {
          setSheetOpen(false);
          track("image_source_selected", { image_source: "camera" });
          cameraInput.current?.click();
        }}
        onGallery={() => {
          setSheetOpen(false);
          track("image_source_selected", { image_source: "gallery" });
          libraryInput.current?.click();
        }}
      />
    </>
  );
}
