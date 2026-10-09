"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the server layout once after mount, e.g. so the sidebar's unread count drops after the inbox was opened. */
export function RefreshOnce({ when }: { when: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (when) router.refresh();
  }, [when, router]);
  return null;
}
