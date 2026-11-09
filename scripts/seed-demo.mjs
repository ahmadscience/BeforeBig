import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { readFile } from "node:fs/promises";

config({ path: ".env.local" });
config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Add the Turso URL to .env.local.");
  process.exit(1);
}

const products = JSON.parse(await readFile(new URL("../src/data/demo-products.json", import.meta.url), "utf8"));
const client = createClient({ url: process.env.DATABASE_URL, authToken: process.env.DATABASE_AUTH_TOKEN });
const dryRun = process.argv.includes("--dry-run");

try {
  const ids = products.map((product) => product.id);
  const slugs = products.map((product) => product.slug);
  const domains = products.map((product) => new URL(product.websiteUrl).hostname.replace(/^www\./, ""));
  const placeholders = products.map(() => "?").join(",");
  const existing = await client.execute({
    sql: `SELECT id, slug, normalized_domain FROM products WHERE id IN (${placeholders}) OR slug IN (${placeholders}) OR normalized_domain IN (${placeholders})`,
    args: [...ids, ...slugs, ...domains],
  });
  const existingRows = existing.rows.map((row) => ({ id: String(row.id), slug: String(row.slug), domain: String(row.normalized_domain) }));
  const statements = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const product of products) {
    const domain = new URL(product.websiteUrl).hostname.replace(/^www\./, "");
    const conflict = existingRows.find((row) => row.id === product.id || row.slug === product.slug || row.domain === domain);
    const contentValues = [
      product.name,
      product.websiteUrl,
      domain,
      product.tagline,
      product.description,
      product.category,
      product.stage,
      product.bestFor,
      product.notBestFor,
      product.price,
      JSON.stringify(product.tags),
      product.status,
      product.verificationStatus,
    ];
    const launchedAt = Date.parse(`${product.launchedAt}T00:00:00.000Z`);
    const updatedAt = Date.now();

    if (conflict && conflict.id !== product.id) {
      skipped += 1;
      continue;
    }
    if (conflict) {
      statements.push({
        sql: "UPDATE products SET name = ?, website_url = ?, normalized_domain = ?, tagline = ?, description = ?, category = ?, stage = ?, best_for = ?, not_best_for = ?, price = ?, tags_json = ?, status = ?, verification_status = ?, updated_at = ? WHERE id = ?",
        args: [...contentValues, updatedAt, product.id],
      });
      updated += 1;
      continue;
    }
    statements.push({
      sql: "INSERT INTO products (id, slug, name, website_url, normalized_domain, tagline, description, category, stage, best_for, not_best_for, price, tags_json, status, verification_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [product.id, product.slug, ...contentValues, launchedAt, updatedAt],
    });
    inserted += 1;
  }

  if (statements.length && !dryRun) await client.batch(statements, "write");
  console.log(`BeforeBig demo seed ${dryRun ? "preview" : "complete"}: ${inserted} inserted, ${updated} updated, ${skipped} skipped.`);
} catch {
  console.error("Demo seed failed. Check the Turso connection and migration status.");
  process.exitCode = 1;
} finally {
  client.close();
}
