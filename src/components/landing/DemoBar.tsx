import Link from "next/link";
import { BRAND } from "@/config/brand";

/**
 * On the demo venues only: they're opened from our home page, so this leads
 * back there (and to the free trial). Real venues' guest pages never show it.
 */
export function DemoBar() {
  return (
    <div className="demo-bar" role="note">
      <Link href="/" className="demo-bar-back">
        ← Back to {BRAND.name}
      </Link>
      <span className="demo-bar-note">This is a demo</span>
      <Link href="/signup" className="demo-bar-cta">
        Start free trial
      </Link>
    </div>
  );
}
