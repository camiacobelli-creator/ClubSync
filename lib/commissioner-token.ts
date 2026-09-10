import crypto from "crypto";

export type CommissionerAction = "approve" | "deny";

const EXPIRY_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function secret() {
  const s = process.env.COMMISSIONER_APPROVAL_SECRET;
  if (!s) throw new Error("COMMISSIONER_APPROVAL_SECRET is not set");
  return s;
}

// token format: base64url(profileId.action.expiresAt).base64url(hmacSignature)
export function signCommissionerToken(profileId: string, action: CommissionerAction): string {
  const expiresAt = Date.now() + EXPIRY_MS;
  const payload = `${profileId}.${action}.${expiresAt}`;
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyCommissionerToken(
  token: string
): { profileId: string; action: CommissionerAction } | null {
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  const expectedSig = crypto.createHmac("sha256", secret()).update(payloadB64).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const payload = Buffer.from(payloadB64, "base64url").toString();
  const [profileId, action, expiresAtStr] = payload.split(".");
  if (!profileId || (action !== "approve" && action !== "deny")) return null;

  const expiresAt = Number(expiresAtStr);
  if (!expiresAt || Date.now() > expiresAt) return null;

  return { profileId, action };
}
