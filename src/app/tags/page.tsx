import { TaxonomyDirectory, directoryMetadata } from "@/components/taxonomy-directory";
import type { QueryParams } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export async function generateMetadata({ searchParams }: { searchParams: Promise<QueryParams> }) { return directoryMetadata("tag", await searchParams); }
export default async function TagsPage({ searchParams }: { searchParams: Promise<QueryParams> }) { return <TaxonomyDirectory kind="tag" params={await searchParams} />; }
