"use client";

import { platforms } from "@/lib/catalog-metadata";
import { useActionState } from "react";
import { updateProduct, type ProductEditState } from "@/app/dashboard/products/[slug]/actions";

type EditableProduct = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  websiteUrl: string;
  category: string;
  stage: string;
  bestFor: string;
  notBestFor: string;
  price: string;
  tagsJson: string;
  platformsJson: string;
  licenseType: string;
  pricingModel: string;
  sourceUrl: string;
};

const initialState: ProductEditState = {};

function tagsFromJson(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.join(", ") : "";
  } catch {
    return "";
  }
}

export function ProductEditForm({ product }: { product: EditableProduct }) {
  const [state, action, pending] = useActionState(updateProduct, initialState);
  return (
    <form action={action} className="editor-form">
      <input type="hidden" name="slug" value={product.slug} />
      <div className="field-grid">
        <label>Product name<input name="name" defaultValue={product.name} required maxLength={80} /></label>
        <label>Website URL<input name="websiteUrl" type="url" defaultValue={product.websiteUrl} required maxLength={2048} /></label>
        <label className="field-wide">Tagline<input name="tagline" defaultValue={product.tagline} required maxLength={140} /></label>
        <label>Category<input name="category" defaultValue={product.category} required maxLength={60} /></label>
        <label>Stage<input name="stage" defaultValue={product.stage} required maxLength={60} /></label>
        <label>Price<input name="price" defaultValue={product.price} required maxLength={80} /></label>
        <label>Pricing model<select name="pricingModel" defaultValue={product.pricingModel}><option value="unknown">Unknown</option><option value="free">Free</option><option value="freemium">Freemium</option><option value="paid">Paid</option></select></label>
        <label>Software license<select name="licenseType" defaultValue={product.licenseType}><option value="unknown">Unknown</option><option value="open-source">Open source</option><option value="proprietary">Proprietary</option></select></label>
        <label className="field-wide">Source repository URL<input name="sourceUrl" type="url" defaultValue={product.sourceUrl} maxLength={2048} placeholder="Required for an open-source claim" /></label>
        <fieldset className="field-wide platform-options"><legend>Supported platforms</legend>{platforms.map((platform) => <label key={platform}><input type="checkbox" name="platforms" value={platform} defaultChecked={tagsFromJson(product.platformsJson).split(", ").includes(platform)} />{platform}</label>)}</fieldset>
        <label>Tags<input name="tags" defaultValue={tagsFromJson(product.tagsJson)} maxLength={240} placeholder="AI, Planning, Agencies" /></label>
        <label className="field-wide">Description<textarea name="description" defaultValue={product.description} required minLength={40} maxLength={2000} rows={5} /></label>
        <label className="field-wide">Best for<textarea name="bestFor" defaultValue={product.bestFor} required minLength={12} maxLength={300} rows={2} /></label>
        <label className="field-wide">Not best for<textarea name="notBestFor" defaultValue={product.notBestFor} required minLength={12} maxLength={300} rows={2} /></label>
      </div>
      <div className="form-action-row">
        <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save product"}</button>
        {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
        {state.message ? <p className="form-success" role="status">{state.message}</p> : null}
      </div>
    </form>
  );
}
