import type { Metadata } from "next";
import { CatalogResults } from "@/components/catalog-results";
import { catalogHref, parseCatalogQuery, type QueryParams } from "@/lib/catalog";

export async function generateMetadata({ searchParams }: { searchParams: Promise<QueryParams> }): Promise<Metadata> {
  const query = parseCatalogQuery(await searchParams);
  return { title: "Discover products", alternates: { canonical: catalogHref("/today", query, query.page) }, robots: { index: Object.keys(query.filters).length === 0 && query.size === 12, follow: true } };
}
export default async function TodayPage({ searchParams }: { searchParams: Promise<QueryParams> }) {
  return <CatalogResults params={await searchParams} />;
}
