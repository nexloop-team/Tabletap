"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";

/** The member's invite link, shared with the phone's share sheet or copied. */
export function InviteFriend({ url, venueName, labels }: { url: string; venueName: string; labels: { title: string; body: string; share: string; copied: string } }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const data = { title: venueName, text: `${venueName}: join their rewards with my invite`, url };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
    } catch (error) {
      // The guest closed the share sheet; nothing to do.
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(labels.share, url);
    }
  }

  return (
    <section className="card-invite">
      <h2>{labels.title}</h2>
      <p className="sub-text">{labels.body}</p>
      <button type="button" className="card-staff-btn secondary" onClick={share}>
        <Share2 aria-hidden />
        {copied ? labels.copied : labels.share}
      </button>
    </section>
  );
}
