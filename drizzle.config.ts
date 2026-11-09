import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });
config({ path: ".env" });

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  ...(databaseUrl
    ? {
        dbCredentials: {
          url: databaseUrl,
          authToken: process.env.DATABASE_AUTH_TOKEN,
        },
      }
    : {}),
});
