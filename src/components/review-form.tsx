"use client";

import { useActionState } from "react";
import { submitReview, type ReviewState } from "@/app/reviews/actions";

const initialState: ReviewState = {};

export function ReviewForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(submitReview, initialState);
  return (
    <form action={action} className="review-form">
      <input type="hidden" name="slug" value={slug} />
      <label>Rating<select name="rating" defaultValue="5"><option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — Mixed</option><option value="2">2 — Weak</option><option value="1">1 — Poor</option></select></label>
      <label>Your experience<textarea name="body" rows={3} minLength={30} maxLength={1500} required placeholder="What did you use it for, and what worked or didn’t?" /></label>
      <button className="button button-ghost" type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit review"}</button>
      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
      {state.message ? <p className="form-success" role="status">{state.message}</p> : null}
    </form>
  );
}
