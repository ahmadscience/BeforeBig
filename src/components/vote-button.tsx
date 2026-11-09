"use client";

import { ArrowUp } from "lucide-react";
import { useActionState } from "react";
import { toggleVoteAction, type VoteActionState } from "@/app/votes/actions";

const initialState: VoteActionState = { status: "idle" };

export function VoteButton({
  slug,
  count,
  hasVoted = false,
  returnTo,
  sample = false,
  size = "compact",
}: {
  slug: string;
  count: number;
  hasVoted?: boolean;
  returnTo: string;
  sample?: boolean;
  size?: "compact" | "large";
}) {
  const [state, formAction, pending] = useActionState(toggleVoteAction, initialState);
  const displayedCount = state.count ?? count;
  const displayedVoted = state.voted ?? hasVoted;
  const accessibleLabel = sample
    ? `${displayedCount.toLocaleString()} sample upvotes; voting is disabled for sample records`
    : displayedVoted
      ? `${displayedCount.toLocaleString()} upvotes; remove your upvote from ${slug}`
      : `${displayedCount.toLocaleString()} upvotes; upvote ${slug}`;

  return (
    <form className={`vote-form vote-form-${size}`} action={formAction}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        className={`vote-button${displayedVoted ? " is-voted" : ""}${sample ? " is-sample" : ""}`}
        aria-label={accessibleLabel}
        aria-pressed={sample ? undefined : displayedVoted}
        disabled={pending || sample}
        title={state.status === "error" ? state.message : sample ? "Sample upvote count — live voting is disabled for demo records" : undefined}
      >
        <ArrowUp aria-hidden="true" size={14} strokeWidth={2.25} />
        <strong>{displayedCount.toLocaleString()}</strong>
        {size === "large" ? <span>{displayedVoted ? "Upvoted" : sample ? "Sample upvotes" : "Upvote"}</span> : null}
      </button>
      {state.status === "error" ? <span className="vote-error" role="alert">{state.message}</span> : null}
    </form>
  );
}
