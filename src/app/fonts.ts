import { Instrument_Sans } from "next/font/google";

/**
 * UI face for merchant-facing pages (dashboard, admin, sign-in, marketing).
 * Applied per `.app` root rather than in the root layout, so guest venue pages
 * keep the system stack and never download it. Headings use the wordmark face
 * (Bricolage Grotesque), loaded once in the root layout.
 */
export const uiFont = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});
