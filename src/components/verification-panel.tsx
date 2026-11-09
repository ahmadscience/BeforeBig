"use client";

import { useActionState } from "react";
import { checkDomainChallenge, createDomainChallenge, type VerificationState } from "@/app/claim/[slug]/actions";

const initialState: VerificationState = {};

export function VerificationPanel({ slug }: { slug: string }) {
  const [createState, createAction, creating] = useActionState(createDomainChallenge, initialState);
  const [checkState, checkAction, checking] = useActionState(checkDomainChallenge, initialState);
  return (
    <div className="verification-panel">
      <div className="verification-step">
        <span>1</span>
        <div><strong>Create a DNS proof</strong><p>BeforeBig generates a product-specific TXT value. It contains no secret.</p></div>
        <form action={createAction}><input type="hidden" name="slug" value={slug} /><button className="button button-ghost" disabled={creating}>{creating ? "Creating…" : "Create TXT record"}</button></form>
      </div>
      {createState.error ? <p className="form-error" role="alert">{createState.error}</p> : null}
      {createState.recordName && createState.recordValue ? (
        <div className="dns-record" role="status">
          <label>Host / name<code>{createState.recordName}</code></label>
          <label>TXT value<code>{createState.recordValue}</code></label>
          <small>TTL can stay on the provider default. The challenge expires after 24 hours.</small>
        </div>
      ) : null}
      <div className="verification-step">
        <span>2</span>
        <div><strong>Check the public record</strong><p>DNS may appear in minutes, though some providers take longer.</p></div>
        <form action={checkAction}><input type="hidden" name="slug" value={slug} /><button className="button button-primary" disabled={checking}>{checking ? "Checking…" : "Check verification"}</button></form>
      </div>
      {checkState.error ? <p className="form-error" role="alert">{checkState.error}</p> : null}
      {checkState.message ? <p className="form-success" role="status">{checkState.message}</p> : null}
    </div>
  );
}
