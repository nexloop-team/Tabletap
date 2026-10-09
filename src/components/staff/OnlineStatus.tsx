"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** "Online" with a green dot, or "Offline" when the till loses its connection (stamps won't save). */
export function OnlineStatus() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  return (
    <span className={`till-paired${online ? "" : " offline"}`} role="status">
      <span aria-hidden /> {online ? "Online" : "Offline"}
    </span>
  );
}
