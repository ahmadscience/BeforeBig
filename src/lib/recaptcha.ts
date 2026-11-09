import { z } from "zod";

const recaptchaResponse = z.object({
  success: z.boolean(),
  challenge_ts: z.string().optional(),
  hostname: z.string().optional(),
  "error-codes": z.array(z.string()).optional(),
});

export function allowedRecaptchaHostnames() {
  const configured = (process.env.RECAPTCHA_ALLOWED_HOSTNAMES ?? "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
  if (configured.length) return configured;
  try {
    return [new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3247").hostname.toLowerCase()];
  } catch {
    return [];
  }
}

export function recaptchaHostnameAllowed(hostname: string | undefined, allowed = allowedRecaptchaHostnames()) {
  return Boolean(hostname && allowed.includes(hostname.toLowerCase()));
}

export function anonymousRecaptchaRequired() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || process.env.RECAPTCHA_SECRET_KEY);
}

export async function verifyRecaptchaToken(token: string) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return { verified: false as const, reason: "configuration_missing" as const };
  if (!token || token.length > 4096) return { verified: false as const, reason: "invalid_token" as const };

  try {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return { verified: false as const, reason: "provider_unavailable" as const };
    const parsed = recaptchaResponse.safeParse(await response.json());
    if (!parsed.success || !parsed.data.success || !recaptchaHostnameAllowed(parsed.data.hostname)) {
      return { verified: false as const, reason: "challenge_failed" as const };
    }

    const challengeAt = parsed.data.challenge_ts ? Date.parse(parsed.data.challenge_ts) : Number.NaN;
    const challengeAge = Date.now() - challengeAt;
    if (!Number.isFinite(challengeAt) || challengeAge < -30_000 || challengeAge > 135_000) {
      return { verified: false as const, reason: "challenge_expired" as const };
    }
    return { verified: true as const, hostname: parsed.data.hostname as string };
  } catch {
    return { verified: false as const, reason: "provider_unavailable" as const };
  }
}
