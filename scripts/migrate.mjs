import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

config({ path: ".env.local" });
config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Add the Turso URL to .env.local.");
  process.exit(1);
}

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

try {
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.log("BeforeBig database migrations are up to date.");
} catch {
  console.error("Database migration failed. Check the Turso connection and migration files.");
  process.exitCode = 1;
} finally {
  client.close();
}
