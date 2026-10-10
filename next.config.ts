import type { NextConfig } from "next";

/**
 * Sent with every response. Pages may only be framed by our own (the
 * editor's phone preview, the home page demos), never by another site, so
 * the dashboard can't be overlaid for clickjacking. The camera is for the
 * till's card scanner on our own pages only.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\" \"https://api.razorpay.com\")" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  // Database drivers load native/wasm parts at runtime, so they stay out of the server bundle.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  // Dev only: let ngrok tunnels load the dev server's scripts (phones testing a QR code, demos).
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app", "*.ngrok.app", "*.ngrok.io"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
