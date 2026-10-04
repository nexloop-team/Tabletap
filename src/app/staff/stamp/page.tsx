import type { Metadata } from "next";
import Link from "next/link";
import { ScanCardButton } from "@/components/staff/ScanCardButton";
import { StaffCardPanel } from "@/components/staff/StaffCardPanel";
import { ServiceError } from "@/server/http";
import { firstParam } from "@/server/request";
import { currentStaffDevice, viewCard } from "@/server/services/staff";

export const metadata: Metadata = { title: "Stamp card" };

/** Opened by scanning a guest's card QR (`/staff/stamp?c=<card id>`) on a paired device. */
export default async function StaffStampPage({ searchParams }: PageProps<"/staff/stamp">) {
  const cardId = firstParam((await searchParams).c);
  const device = await currentStaffDevice();
  if (!device) {
    return (
      <section className="card">
        <h1 style={{ fontSize: 22 }}>This isn&apos;t a staff device</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Only the venue&apos;s paired till devices can add stamps. If you&apos;re a guest, show this code to a member of staff.
        </p>
      </section>
    );
  }

  let view;
  try {
    view = viewCard(device, cardId);
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
    return (
      <section className="card">
        <h1 style={{ fontSize: 22 }}>Can&apos;t open this card</h1>
        <p className="muted" style={{ marginTop: 8 }}>{error.message}</p>
        <Link className="btn" href="/staff" style={{ marginTop: 16 }}>
          Back
        </Link>
      </section>
    );
  }

  return (
    <>
      <StaffCardPanel key={view.cardId} initial={view} />
      <div className="stack" style={{ marginTop: 14 }}>
        <ScanCardButton label="Scan the next card" primary={false} />
        <Link className="btn btn-ghost btn-block" href="/staff">
          Done
        </Link>
      </div>
    </>
  );
}
