/**
 * Refer-a-friend on the guest page: an invite link carries `?ref=<code>`.
 * It's remembered for this browser tab (per venue) so it still applies if
 * the friend joins after looking around, and sent with the join.
 */

const key = (venueId: string) => `tt_ref:${venueId}`;
const CODE = /^[a-z0-9]{6,16}$/i;

export function rememberReferral(venueId: string) {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && CODE.test(ref)) sessionStorage.setItem(key(venueId), ref.toLowerCase());
  } catch {
    /* storage blocked: the invite just won't count */
  }
}

export function storedReferral(venueId: string): string | undefined {
  try {
    const ref = sessionStorage.getItem(key(venueId));
    return ref && CODE.test(ref) ? ref : undefined;
  } catch {
    return undefined;
  }
}
