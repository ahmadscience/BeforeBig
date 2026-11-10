import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/db/schema";
import { createMediaStore } from "../src/db/media";
import { getMediaStorage } from "../src/lib/media-storage";
import { cleanupMedia } from "../src/lib/media-service";

async function main() {
  config({ path: ".env.local" }); config({ path: ".env" });
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--apply") || !process.env.DATABASE_URL) {
    console.error("Usage: pnpm media:cleanup [--apply]. Configure your own database and private media storage first.");
    process.exit(1);
  }
  let client: ReturnType<typeof createClient> | undefined;
  try {
    client = createClient({ url: process.env.DATABASE_URL, authToken: process.env.DATABASE_AUTH_TOKEN });
    const storage = getMediaStorage(); if (!storage) throw Error("Storage unavailable");
    const result = await cleanupMedia(createMediaStore(drizzle(client, { schema })), storage, args.includes("--apply"));
    console.log(JSON.stringify({ mode: args.includes("--apply") ? "apply" : "dry-run", ...result }));
    if (result.failed) process.exitCode = 1;
  } catch {
    // Aggregate output only: keys, user details, paths, and provider credentials never reach logs.
    console.error("Media cleanup failed. Check storage configuration, credentials, and database migrations."); process.exitCode = 1;
  } finally { client?.close(); }
}
void main();
