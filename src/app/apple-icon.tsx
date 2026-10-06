import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the full mark on a square tile (iOS rounds the corners itself). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#24573F" }}>
        <svg width="180" height="180" viewBox="0 0 72 72">
          <path d="M18 25h36M36 25v22M27 49h18" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" fill="none" />
          <circle cx="53" cy="13.5" r="4.5" fill="#F2B48A" />
        </svg>
      </div>
    ),
    size,
  );
}
