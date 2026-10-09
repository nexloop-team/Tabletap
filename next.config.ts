import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Database drivers load native/wasm parts at runtime, so they stay out of the server bundle.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  // Dev only: let ngrok tunnels load the dev server's scripts (phones testing a QR code, demos).
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app", "*.ngrok.app", "*.ngrok.io"],
};

export default nextConfig;
