"use client";

import { useActionState } from "react";
import { publishProductUpdate, type ProductUpdateState } from "@/app/dashboard/products/[slug]/updates-actions";

const initialState: ProductUpdateState = {};

export function ProductUpdateForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(publishProductUpdate, initialState);
  return (
    <form action={action} className="update-form">
      <input type="hidden" name="slug" value={slug} />
      <label>Update title<input name="title" required minLength={5} maxLength={100} placeholder="What changed?" /></label>
      <label>Details<textarea name="body" required minLength={30} maxLength={2000} rows={4} placeholder="Share a concrete product milestone, release, or correction." /></label>
      <div className="form-action-row"><button className="button button-ghost" disabled={pending}>{pending ? "Publishing…" : "Publish update"}</button>{state.error ? <p className="form-error">{state.error}</p> : null}{state.message ? <p className="form-success">{state.message}</p> : null}</div>
    </form>
  );
}
