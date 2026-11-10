"use client";
import { useActionState, type ReactNode } from "react";
import { mediaAction } from "@/app/media/actions";
import type { MediaState } from "@/lib/media";

export function MediaForm({ id, operation, label, children, fields = {} }: {
  id: string; operation: string; label: string; children?: ReactNode; fields?: Record<string, string>;
}) {
  const [state, action, pending] = useActionState<MediaState, FormData>(mediaAction, {});
  return <form action={action} className="media-form">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="operation" value={operation} />
    {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
    {children}
    <button type="submit" className="button button-ghost" disabled={pending}>{pending ? "Saving…" : label}</button>
    {state.error ? <p role="alert" className="form-error">{state.error}</p> : null}
    {state.message ? <p role="status" className="form-success">{state.message}</p> : null}
  </form>;
}
