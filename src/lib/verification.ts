import { createHmac } from "node:crypto";

export function verificationRecordName(domain: string) {
  return `_beforebig.${domain}`;
}

export function verificationRecordValue(challengeId: string, productId: string, userId: string) {
  const secret = process.env.VERIFICATION_SECRET;
  if (!secret) return null;
  const proof = createHmac("sha256", secret).update(`${challengeId}:${productId}:${userId}`).digest("base64url");
  return `beforebig-site-verification=${challengeId}.${proof}`;
}
