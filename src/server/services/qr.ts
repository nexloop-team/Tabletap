import "server-only";
import QRCode from "qrcode";

/** Where printed codes point. APP_URL pins it, so codes printed from a preview deploy still work. */
export function publicOrigin(requestOrigin: string): string {
  return (process.env.APP_URL || requestOrigin).replace(/\/+$/, "");
}

/** The guest page URL a QR code encodes; `source` tells scans from table 4 apart from the window poster. */
export function guestPageUrl(origin: string, shortCode: string, source?: string | null): string {
  const url = new URL("/s", origin);
  url.searchParams.set("i", shortCode);
  if (source) url.searchParams.set("s", source);
  return url.toString();
}

const OPTIONS = { errorCorrectionLevel: "M" as const, margin: 2 };

export function qrSvg(text: string, color = "#000000"): Promise<string> {
  return QRCode.toString(text, { ...OPTIONS, type: "svg", color: { dark: color, light: "#ffffff" } });
}

export function qrPng(text: string, width: number, color = "#000000"): Promise<Buffer> {
  return QRCode.toBuffer(text, { ...OPTIONS, type: "png", width, color: { dark: color, light: "#ffffff" } });
}
