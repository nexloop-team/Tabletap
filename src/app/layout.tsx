import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { BRAND } from "@/config/brand";
import { isRtl } from "@/lib/i18n";
import { requestLocale } from "@/server/request";
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
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: "QR-code pages for cafés, bars and restaurants: menus, Wi-Fi, loyalty cards and feedback.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await requestLocale();
  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"} className={wordmark.variable}>
      <body>{children}</body>
    </html>
  );
}
