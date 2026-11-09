"use client";

import type { Route } from "next";
import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { useActionState } from "react";
import { withdrawDownvoteAction, type DownvoteActionState } from "@/app/downvotes/actions";

const initialState: DownvoteActionState = { status: "idle" };

export function DownvoteButton({ slug, count, hasDownvoted = false, downvoteStatus, returnTo, sample = false, enabled = true, size = "compact" }: {
  slug: string;
  count: number;
  hasDownvoted?: boolean;
  downvoteStatus?: "pending" | "approved";
  returnTo: string;
  sample?: boolean;
  enabled?: boolean;
  size?: "compact" | "large";
}) {
  const [state, formAction, pending] = useActionState(withdrawDownvoteAction, initialState);
  const displayedCount = state.count ?? count;
  const displayedDownvoted = state.downvoted ?? hasDownvoted;
  const unavailable = sample || !enabled;
  const className = `downvote-button downvote-button-${size}${displayedDownvoted ? " is-downvoted" : ""}${unavailable ? " is-sample" : ""}`;
  const contents = <><ArrowDown aria-hidden="true" size={14} strokeWidth={2.25} /><strong>{displayedCount.toLocaleString()}</strong>{size === "large" ? <span>{displayedDownvoted ? downvoteStatus === "pending" ? "Pending review" : "Withdraw" : sample ? "Sample downvotes" : !enabled ? "Coming in production" : "Downvote"}</span> : null}</>;

  if (sample) return <button type="button" className={className} disabled aria-label={`${displayedCount} sample downvotes; downvoting is disabled for sample records`} title="Sample downvote count">{contents}</button>;
  if (!enabled && !displayedDownvoted) return <button type="button" className={className} disabled aria-label={`${displayedCount} approved downvotes; new downvotes are unavailable`} title="Downvotes are temporarily unavailable">{contents}</button>;
  if (!displayedDownvoted) return <Link className={className} href={`/${slug}/downvote` as Route} aria-label={`${displayedCount} approved downvotes; downvote ${slug} with a private written reason`}>{contents}</Link>;
  return (
    <form className="downvote-withdraw-form" action={formAction}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button type="submit" className={className} disabled={pending} aria-label={`${displayedCount} approved downvotes; withdraw your ${downvoteStatus === "pending" ? "pending " : ""}downvote from ${slug}`} title={state.status === "error" ? state.message : "Withdraw downvote"}>{contents}</button>
      {state.status === "error" ? <span className="vote-error" role="alert">{state.message}</span> : null}
    </form>
  );
}
