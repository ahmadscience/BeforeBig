import { drizzle } from "drizzle-orm/libsql/web";
import * as schema from "@/db/schema";

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return drizzle({
    connection: {
      url,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    },
    schema,
  });
}
