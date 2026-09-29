import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import { BRAND } from "@/config/brand";
import { isRtl } from "@/lib/i18n";
import { requestLocale } from "@/server/request";
import "./globals.css";

/** Footer wordmark only; the UI itself uses the system font stack. */
const wordmark = Fraunces({
  variable: "--font-wordmark",
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
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
