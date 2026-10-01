import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/icons";
import { BRAND } from "@/config/brand";
import "@/styles/app.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app auth-shell">
      <div className="auth-box">
        <Link className="wordmark" href="/">
          <BrandMark />
          {BRAND.name}
        </Link>
        {children}
      </div>
    </div>
  );
}
