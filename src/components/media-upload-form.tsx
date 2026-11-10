"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { mediaLimits, mediaTypes, mediaUploadMetadataSchema, type MediaState } from "@/lib/media";

export function MediaUploadForm({ slug, enabled, message, full }: { slug: string; enabled: boolean; message: string; full: boolean }) {
  const [state, setState] = useState<MediaState>({}); const [pending, setPending] = useState(false);
  const busy = useRef(false); const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current) return;
    const form = event.currentTarget; const data = new FormData(form); const file = data.get("file");
    const input = mediaUploadMetadataSchema.safeParse({ altText: data.get("altText"), caption: data.get("caption"), kind: data.get("kind"), rightsConfirmed: data.get("rightsConfirmed") === "on" });
    if (!input.success) { setState({ error: input.error.issues[0]?.message }); return; }
    // These checks explain errors quickly; the server independently verifies bytes and dimensions.
    if (!(file instanceof File) || !file.size || file.size > mediaLimits.inputBytes || !mediaTypes.includes(file.type as typeof mediaTypes[number])) { setState({ error: "Choose a PNG, JPEG, or WebP image up to 4 MiB." }); return; }
    busy.current = true; setPending(true); setState({});
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(slug)}/media`, { method: "POST", body: file, credentials: "same-origin", headers: { "Content-Type": file.type, "X-Media-Metadata": encodeURIComponent(JSON.stringify(input.data)) } });
      const result = await response.json();
      if (!response.ok) { setState({ error: result.error || "Upload failed. Try again later." }); return; }
      setState({ message: result.message }); form.reset(); router.refresh();
    } catch { setState({ error: "Upload interrupted. Refresh the gallery before retrying." }); }
    finally { busy.current = false; setPending(false); }
  }
  return <form onSubmit={submit} className="media-form media-upload-form">
    <p className="muted">{message}. Images stay private until another moderator approves them. Originals are replaced with a metadata-free WebP image.</p>
    <fieldset disabled={!enabled || full || pending}>
      <label>Image file<input type="file" name="file" accept="image/png,image/jpeg,image/webp" required /></label>
      <label>Image type<select name="kind"><option value="screenshot">Screenshot</option><option value="image">Product image</option></select></label>
      <label>Describe what the image shows<input name="altText" minLength={3} maxLength={200} required placeholder="e.g. Project board showing this week's tasks" /></label>
      <label>Caption (optional)<textarea name="caption" maxLength={300} rows={2} /></label>
      <label className="media-rights"><input type="checkbox" name="rightsConfirmed" required /><span>I own this image or have permission to share it. I checked the visible content for personal information and secrets.</span></label>
      <p className="form-note">Still images only, at least 32 × 32 pixels, up to 8,192 pixels per side and 12 megapixels. No SVG, GIF, or video.</p>
      <button className="button button-primary" disabled={!enabled || full || pending}>{pending ? "Validating and uploading…" : full ? "Gallery full — remove an image first" : "Upload for review"}</button>
    </fieldset>
    {state.error ? <p role="alert" className="form-error">{state.error}</p> : null}
    {state.message ? <p role="status" className="form-success">{state.message}</p> : null}
  </form>;
}
