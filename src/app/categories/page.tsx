import { TaxonomyDirectory, directoryMetadata } from "@/components/taxonomy-directory";
import type { QueryParams } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export async function generateMetadata({ searchParams }: { searchParams: Promise<QueryParams> }) { return directoryMetadata("category", await searchParams); }
export default async function CategoriesPage({ searchParams }: { searchParams: Promise<QueryParams> }) { return <TaxonomyDirectory kind="category" params={await searchParams} />; }
