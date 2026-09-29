/** Browser-only helpers. Every function here must be called from an event handler or effect. */

export type PlatformKey = "ios" | "android" | "windows" | "mac" | "unknown";

export function getPlatform(): PlatformKey {
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Windows/i.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  return "unknown";
}

/**
 * For useSyncExternalStore reads of values that never change during a visit
 * (platform, localStorage on load): the server snapshot renders first, the
 * client value right after hydration, without an effect.
 */
export const subscribeNever = () => () => {};

export function isApplePlatform(platform = getPlatform()): boolean {
  return platform === "ios" || platform === "mac";
}

export async function copyToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const temp = document.createElement("textarea");
  temp.value = value;
  temp.setAttribute("readonly", "");
  temp.style.position = "absolute";
  temp.style.left = "-9999px";
  document.body.appendChild(temp);
  temp.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(temp);
  if (!ok) throw new Error("Copy failed");
}

/** localStorage that never throws: private windows and blocked storage just forget. */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* the device simply won't remember */
    }
  },
};

/**
 * Per-venue device memory. Only the opaque customer id is stored — never the
 * guest's email or name.
 */
export const deviceMemory = {
  customerId: (venueId: string) => safeStorage.get(`tt.customer.${venueId}`),
  rememberCustomer: (venueId: string, customerId: string) => safeStorage.set(`tt.customer.${venueId}`, customerId),
  /** "1" / "2" = skipped once / twice, "answered" = saved. */
  birthdayState: (venueId: string) => safeStorage.get(`tt.bday.${venueId}`) ?? "",
  setBirthdayState: (venueId: string, state: string) => safeStorage.set(`tt.bday.${venueId}`, state),
};

/**
 * Downscales a photo to at most 1200px on its longest side and re-encodes it
 * as JPEG 0.7 — small enough to post inline, and it strips EXIF location.
 */
export function compressImage(file: File, maxDim = 1200, quality = 0.7): Promise<{ base64: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          } else {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve({ base64: dataUrl.split(",")[1] ?? "", dataUrl });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
