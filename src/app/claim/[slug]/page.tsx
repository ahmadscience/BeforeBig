import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VerificationPanel } from "@/components/verification-panel";
import { requireUser } from "@/lib/auth";
import { findPersistedProductRowBySlug } from "@/db/products";

export const metadata: Metadata = { title: "Verify ownership", robots: { index: false, follow: false } };

type ClaimPageProps = { params: Promise<{ slug: string }> };

export default async function ClaimPage({ params }: ClaimPageProps) {
  const { slug } = await params;
  await requireUser(`/claim/${slug}`);
  const product = await findPersistedProductRowBySlug(slug);
  if (!product) notFound();
  return (
    <section className="shell manage-section">
      <div className="manage-heading">
        <div><p className="eyebrow">Ownership verification</p><h1>Prove you control {product.normalizedDomain}</h1><p>Add one DNS TXT record. BeforeBig never asks for access to your domain account.</p></div>
        <Link href={`/${product.slug}`} className="button button-ghost">View public record ↗</Link>
      </div>
      {product.verificationStatus !== "unverified" ? (
        <div className="success-card"><span>✓</span><div><strong>Ownership verified</strong><p>This product is {product.verificationStatus.replaceAll("_", " ")}.</p></div></div>
      ) : <VerificationPanel slug={product.slug} />}
    </section>
  );
}
