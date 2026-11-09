import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownvoteForm } from "@/components/downvote-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { findPersistedProductRowBySlug } from "@/db/products";
import { requireUser } from "@/lib/auth";
import { productAcceptsVotes } from "@/lib/votes";

type DownvotePageProps = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Submit a downvote", robots: { index: false, follow: false } };

export default async function DownvotePage({ params }: DownvotePageProps) {
  const { slug } = await params;
  await requireUser(`/${slug}/downvote`);
  const product = await findPersistedProductRowBySlug(slug);
  if (!product || !productAcceptsVotes(product.status)) notFound();
  return (
    <section className="shell narrow-section downvote-page">
      <Link className="back-link" href={`/${product.slug}`}>← Back to {product.name}</Link>
      <Card className="downvote-panel">
        <CardHeader className="downvote-intro">
          <p className="eyebrow">Accountable feedback</p>
          <h1>Downvote {product.name}</h1>
          <p>A downvote is a serious community signal. Explain one concrete concern. It remains private and pending until a moderator reviews it.</p>
        </CardHeader>
        <CardContent className="p-0">
          <DownvoteForm slug={product.slug} />
        </CardContent>
      </Card>
    </section>
  );
}
