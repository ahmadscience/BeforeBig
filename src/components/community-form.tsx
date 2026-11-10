"use client";

import { useActionState, type ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { communityAction } from "@/app/community/actions";
import type { CommunityState } from "@/lib/community";

export function CommunityForm({ operation, fields = {}, children, label, className = "community-form" }: {
  operation: string; fields?: Record<string, string>; children?: ReactNode; label: string; className?: string;
}) {
  const [state, action, pending] = useActionState<CommunityState, FormData>(communityAction, {});
  return <form action={action} className={className}>
    <input type="hidden" name="operation" value={operation} />
    {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
    {children}
    <button type="submit" className="button button-ghost" disabled={pending}>{pending ? "Saving…" : label}</button>
    {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
    {state.message ? <p className="form-success" role="status">{state.message} {state.href ? <Link href={state.href as Route}>Open collection →</Link> : null}</p> : null}
  </form>;
}
