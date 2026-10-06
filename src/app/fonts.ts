import { Inter } from "next/font/google";

/**
 * UI face for merchant-facing pages (dashboard, admin, sign-in, marketing).
 * Applied per `.app` root rather than in the root layout, so guest venue pages
 * keep the system stack and never download it.
 */
export const uiFont = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});
