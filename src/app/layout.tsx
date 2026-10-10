import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { BRAND } from "@/config/brand";
import { LOCALE } from "@/lib/i18n";
import "./globals.css";

/**
 * Wordmark face, one weight. Guest pages only use it for the footer lockup;
 * merchant pages also use it for headings and stat numbers.
 */
const wordmark = Bricolage_Grotesque({
  variable: "--font-wordmark",
  subsets: ["latin"],
  weight: "700",
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute links for share previews (Vercel supplies its own address when APP_URL isn't set).
  ...(process.env.APP_URL ? { metadataBase: new URL(process.env.APP_URL) } : {}),
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: "QR-code pages for cafés, bars and restaurants: menus, Wi-Fi, loyalty cards and feedback.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={LOCALE} className={wordmark.variable}>
      <body>{children}</body>
    </html>
  );
}
