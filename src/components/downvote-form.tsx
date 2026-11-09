"use client";

import { ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import { submitDownvoteAction, type DownvoteActionState } from "@/app/downvotes/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const initialState: DownvoteActionState = { status: "idle" };

export function DownvoteForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(submitDownvoteAction, initialState);

  return (
    <form className="downvote-reason-form" action={formAction}>
      <input type="hidden" name="slug" value={slug} />
      <label htmlFor="downvote-reason">What is the specific concern?</label>
      <Textarea id="downvote-reason" name="reason" required minLength={20} maxLength={500} rows={6} placeholder="Describe a concrete problem, misleading claim, harmful behavior, or poor experience. Be factual and fair." />
      <div className="reason-guidance"><span>20–500 characters</span><span>Private moderation evidence</span></div>
      {state.status === "error" ? <p className="form-error" role="alert">{state.message}</p> : null}
      <Button className="button w-full" variant="destructive" size="lg" type="submit" disabled={pending}>
        <ShieldCheck aria-hidden="true" size={16} />
        {pending ? "Checking…" : "Submit downvote"}
      </Button>
      <p className="form-note">Registered users skip reCAPTCHA. Your account and anonymized network limit abuse; your identity and reason are visible only to moderators.</p>
    </form>
  );
}
