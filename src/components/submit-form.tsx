"use client";

import { useActionState } from "react";
import { createProductDraft, type SubmissionState } from "@/app/actions";

const initialState: SubmissionState = {};

export function SubmitForm() {
  const [state, formAction, pending] = useActionState(createProductDraft, initialState);
  return (
    <div className="submit-panel">
      <div>
        <p className="eyebrow">Free demo</p>
        <h2>Put your product on the map.</h2>
        <p className="muted">Paste a public URL. BeforeBig creates a safe, editable starting point for your product record.</p>
      </div>
      <form action={formAction} className="url-form">
        <label htmlFor="url">Product website</label>
        <div className="url-row">
          <input id="url" name="url" type="url" placeholder="https://yourproduct.com" required autoComplete="url" />
          <button type="submit" disabled={pending}>{pending ? "Checking…" : "Create draft"}</button>
        </div>
        <p className="form-note">Only public HTTP/HTTPS websites are accepted. Remote metadata fetching is disabled in this demo.</p>
        {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
        {state.signInHref ? <a className="text-link" href={state.signInHref}>Sign in to continue →</a> : null}
        {state.draft ? (
          <div className={`draft-result draft-result-${state.storage ?? "disabled"}`} role="status">
            <span className="status-dot" />
            <div>
              <strong>{state.draft.name}</strong>
              <p>{state.draft.url}</p>
              <small>{state.message ?? state.draft.note}</small>
              {state.draft.href ? <a href={state.draft.href}>Open public noindex preview →</a> : null}
            </div>
          </div>
        ) : null}
      </form>
    </div>
  );
}
