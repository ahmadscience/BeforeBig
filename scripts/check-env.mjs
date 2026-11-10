import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const errors = [];

function required(name, minimumLength = 1) {
  const value = process.env[name]?.trim();
  if (!value || value.length < minimumLength) errors.push(`${name} is required and must be at least ${minimumLength} characters.`);
  return value;
}

const databaseUrl = required("DATABASE_URL", 16);
required("DATABASE_AUTH_TOKEN", 20);
required("ANALYTICS_HASH_SALT", 32);
required("RATE_LIMIT_HASH_SALT", 32);
required("VOTE_IP_HASH_SALT", 32);
required("VERIFICATION_SECRET", 32);
required("NEXT_PUBLIC_RECAPTCHA_SITE_KEY", 20);
required("RECAPTCHA_SECRET_KEY", 20);
const recaptchaHostnames = required("RECAPTCHA_ALLOWED_HOSTNAMES", 3);
const appUrl = required("NEXT_PUBLIC_APP_URL", 8);
const adminEmails = required("ADMIN_EMAILS", 3);

if (databaseUrl && !databaseUrl.startsWith("libsql://")) errors.push("DATABASE_URL must use the libsql:// Turso scheme.");
if (appUrl) {
  try {
    if (new URL(appUrl).protocol !== "https:") errors.push("NEXT_PUBLIC_APP_URL must use HTTPS for deployment.");
  } catch {
    errors.push("NEXT_PUBLIC_APP_URL must be a valid absolute URL.");
  }
}
if (adminEmails && !adminEmails.split(",").every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
  errors.push("ADMIN_EMAILS must be a comma-separated list of valid email addresses.");
}
if (recaptchaHostnames && recaptchaHostnames.split(",").some((hostname) => !hostname.trim() || hostname.includes("/") || hostname.includes(":"))) {
  errors.push("RECAPTCHA_ALLOWED_HOSTNAMES must contain comma-separated hostnames without schemes, ports, or paths.");
}

if (process.env.SUBMISSION_PERSISTENCE_ENABLED !== "true") errors.push("SUBMISSION_PERSISTENCE_ENABLED must be true for the live MVP.");
if (process.env.EMAIL_FEATURE_ENABLED !== "true") errors.push("EMAIL_FEATURE_ENABLED must be true for the live MVP.");
if (!["resend", "postmark", "mailgun"].includes(process.env.EMAIL_PROVIDER ?? "")) errors.push("EMAIL_PROVIDER must be resend, postmark, or mailgun.");
required("EMAIL_API_KEY", 12);
required("EMAIL_FROM", 5);
if (process.env.EMAIL_PROVIDER === "mailgun") {
  required("MAILGUN_DOMAIN", 3);
  const mailgunBaseUrl = process.env.MAILGUN_API_BASE_URL?.trim() || "https://api.mailgun.net";
  if (!["https://api.mailgun.net", "https://api.eu.mailgun.net"].includes(mailgunBaseUrl.replace(/\/$/, ""))) {
    errors.push("MAILGUN_API_BASE_URL must be the Mailgun US or EU API origin.");
  }
}

if (process.env.MEDIA_UPLOADS_ENABLED === "true") {
  if (process.env.MEDIA_STORAGE_DRIVER !== "s3") errors.push("Production media uploads require the s3 storage driver.");
  const bucket = required("MEDIA_S3_BUCKET");
  if (bucket && !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) errors.push("MEDIA_S3_BUCKET must be a valid bucket name.");
  required("MEDIA_S3_REGION"); required("MEDIA_S3_ACCESS_KEY_ID"); required("MEDIA_S3_SECRET_ACCESS_KEY");
  if (process.env.MEDIA_S3_ENDPOINT) {
    try {
      const endpoint = new URL(process.env.MEDIA_S3_ENDPOINT);
      if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.pathname !== "/" || endpoint.search || endpoint.hash) errors.push("MEDIA_S3_ENDPOINT must be an HTTPS origin only.");
    } catch { errors.push("MEDIA_S3_ENDPOINT must be a valid HTTPS origin."); }
  }
}

if (errors.length) {
  console.error("BeforeBig deployment environment is incomplete:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("BeforeBig deployment environment looks valid.");
