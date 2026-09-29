import "server-only";

export interface IssuedPass {
  /** Signed Apple .pkpass as base64. */
  passBase64: string | null;
  /** https://pay.google.com/gp/v/save/<jwt> */
  googleWalletUrl: string | null;
}

export interface PassSubject {
  cardId: string;
  venueName: string;
  holderName: string | null;
  stamps: number;
}

/**
 * Wallet pass issuance. Both platforms need merchant credentials we do not
 * have yet — an Apple Pass Type ID certificate for signing .pkpass bundles,
 * and a Google Wallet issuer account for the save JWT — so until those env
 * vars exist this returns no pass. The UI handles that exactly like a
 * platform without a pass: no Wallet button, and the card link is emailed.
 */
export function issueWalletPass(subject: PassSubject): IssuedPass {
  void subject;
  const appleConfigured = !!process.env.APPLE_PASS_CERT_PATH;
  const googleConfigured = !!process.env.GOOGLE_WALLET_ISSUER_ID;
  if (appleConfigured || googleConfigured) {
    console.warn("[wallet] credentials are set but pass signing is not implemented yet");
  }
  return { passBase64: null, googleWalletUrl: null };
}
