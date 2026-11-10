import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductMediaManager } from "@/components/product-media";
import { ProductEditForm } from "@/components/product-edit-form";
import { ProductUpdateForm } from "@/components/product-update-form";
import { requireUser } from "@/lib/auth";
import { findPersistedProductRowBySlug, getProductMembership } from "@/db/products";

export const metadata: Metadata = { title: "Edit product", robots: { index: false, follow: false } };

type EditPageProps = { params: Promise<{ slug: string }> };

export default async function EditProductPage({ params }: EditPageProps) {
  const { slug } = await params;
  const user = await requireUser(`/dashboard/products/${slug}`);
  const product = await findPersistedProductRowBySlug(slug);
  if (!product) notFound();
  const membership = await getProductMembership(product.id, user.id);
  if (!membership) notFound();
  return (
    <section className="shell manage-section">
      <div className="manage-heading">
        <div><p className="eyebrow">Founder workspace</p><h1>Edit {product.name}</h1><p>Keep the permanent record concise, specific, and honest.</p></div>
        <Link href={`/${product.slug}`} className="button button-ghost">View public record ↗</Link>
      </div>
      <div className="status-strip"><span className="status-dot" /> {product.status} · {product.verificationStatus.replaceAll("_", " ")} · access: {membership.role}</div>
      <div className="panel"><ProductEditForm product={product} /></div>
      <ProductMediaManager actor={user} slug={product.slug} />
      <div className="panel manage-content-panel"><div><p className="eyebrow">Record update</p><h2>Publish a milestone</h2><p className="muted">Updates are append-only public history. Keep them factual.</p></div><ProductUpdateForm slug={product.slug} /></div>
      <div className="manage-actions">
        <Link href={`/claim/${product.slug}` as Route} className="button button-primary">Verify domain ownership →</Link>
      </div>
    </section>
  );
}
