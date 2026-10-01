"use client";

import {
  CreditCard,
  Gift,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Palette,
  QrCode,
  Settings,
  Shield,
  UserRound,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { dashboardApi } from "@/lib/api/dashboard-client";

export function VenueSwitcher({ venues }: { venues: { id: string; name: string }[] }) {
  const router = useRouter();
  const params = useParams<{ venueId?: string }>();
  const current = params.venueId ?? "";
  if (venues.length === 0) return null;
  return (
    <select
      className="select venue-switch"
      aria-label="Switch venue"
      value={venues.some((venue) => venue.id === current) ? current : ""}
      onChange={(event) => router.push(event.target.value === "__new" ? "/onboarding" : `/dashboard/${event.target.value}`)}
    >
      {!venues.some((venue) => venue.id === current) && <option value="">All venues</option>}
      {venues.map((venue) => (
        <option key={venue.id} value={venue.id}>
          {venue.name}
        </option>
      ))}
      <option value="__new">+ Add a venue</option>
    </select>
  );
}

export function TopbarLinks({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function signOut() {
    setPending(true);
    try {
      await dashboardApi.logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }
  return (
    <>
      {isAdmin && (
        <Link className="account-link inline" href="/admin">
          <Shield size={16} aria-hidden /> <span>Admin</span>
        </Link>
      )}
      <Link className="account-link inline" href="/dashboard/account">
        <UserRound size={16} aria-hidden /> <span>Account</span>
      </Link>
      <button type="button" className="btn btn-ghost btn-sm" onClick={signOut} disabled={pending} aria-label="Sign out">
        <LogOut aria-hidden />
      </button>
    </>
  );
}

const NAV = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/design", label: "Guest page", icon: Palette },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/loyalty", label: "Loyalty & capture", icon: Gift, pro: true },
  { href: "/guests", label: "Guests", icon: Users },
  { href: "/feedback", label: "Feedback", icon: MessageSquareText },
  { href: "/qr", label: "QR codes", icon: QrCode },
  { href: "/billing", label: "Plan & billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SideNav({ venueId, isPro }: { venueId: string; isPro: boolean }) {
  const pathname = usePathname();
  const base = `/dashboard/${venueId}`;
  return (
    <nav className="sidenav" aria-label="Venue">
      {NAV.map((item) => {
        const href = base + item.href;
        const active = item.href === "" ? pathname === base : pathname === href || pathname.startsWith(`${href}/`);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={href} aria-current={active ? "page" : undefined}>
            <Icon aria-hidden />
            {item.label}
            {item.pro && !isPro && <span className="badge badge-pro nav-pro">Pro</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function ResendVerification() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  if (state === "sent") return <span>Sent. Check your inbox.</span>;
  return (
    <button
      type="button"
      className="btn btn-sm"
      disabled={state === "sending"}
      onClick={async () => {
        setState("sending");
        try {
          await dashboardApi.resendVerification();
          setState("sent");
        } catch {
          setState("error");
        }
      }}
    >
      {state === "error" ? "Try again" : "Resend email"}
    </button>
  );
}
