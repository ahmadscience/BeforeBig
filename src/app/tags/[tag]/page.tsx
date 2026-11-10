import { notFound } from "next/navigation";
import { CatalogResults } from "@/components/catalog-results";
import { catalogTerm } from "@/lib/catalog-data";
import { decodeTaxonomyParam, taxonomyPath, type QueryParams } from "@/lib/catalog";
import { taxonomyMetadata } from "@/lib/catalog-metadata-page";

type Props = { params: Promise<{ tag: string }>; searchParams: Promise<QueryParams> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params, searchParams }: Props) {
  const key = decodeTaxonomyParam((await params).tag);
  return key === null ? { robots: { index: false, follow: true } } : taxonomyMetadata("tag", key, await searchParams);
}
export default async function TagPage({ params, searchParams }: Props) {
  const key = decodeTaxonomyParam((await params).tag);
  if (key === null) notFound();
  const { item, source } = await catalogTerm("tag", key);
  if (!item) { if (source === "fallback") throw new Error("The catalog is temporarily unavailable."); notFound(); }
  return <CatalogResults path={taxonomyPath("tag", item.key)} params={await searchParams} scope={{ kind: "tag", key: item.key, label: item.label }} />;
}
