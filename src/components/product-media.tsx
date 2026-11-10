import { getMediaStore, type MediaActor } from "@/db/media";
import { mediaUploadAvailability } from "@/lib/media-storage";
import { mediaLimits } from "@/lib/media";
import { MediaImage } from "@/components/media-image";
import { MediaForm } from "@/components/media-form";
import { MediaUploadForm } from "@/components/media-upload-form";

export async function ProductMediaGallery({ productId }: { productId: string }) {
  const items = await getMediaStore()?.publicMedia(productId) ?? [];
  if (!items.length) return null;
  return <section className="product-block"><div className="block-heading"><div><p className="eyebrow">Inside the product</p><h2>Screenshots & images</h2></div><span className="muted">{items.length} images</span></div>
    <div className="media-gallery">{items.map((item) => <figure key={item.id}><MediaImage item={item} />{item.caption ? <figcaption>{item.caption}</figcaption> : null}</figure>)}</div>
  </section>;
}
export async function ProductMediaManager({ actor, slug }: { actor: MediaActor; slug: string }) {
  const items = await getMediaStore()?.ownedMedia(actor, slug) ?? []; const availability = mediaUploadAvailability();
  const cover = items.find((item) => item.status === "approved")?.id;
  return <section className="panel manage-content-panel media-manager"><div><p className="eyebrow">Product gallery</p><h2>Screenshots & images <span className="muted">{items.length}/{mediaLimits.items}</span></h2><p className="muted">Show the real interface. Keep text readable and remove private information before uploading.</p></div>
    <MediaUploadForm slug={slug} {...availability} full={items.length >= mediaLimits.items} />
    <div className="media-manager-grid">{items.map((item) => <article key={item.id} className="media-manage-item">
      {!["uploading", "failed"].includes(item.status) ? <MediaImage item={item} /> : <p className="muted">Image is not available yet.</p>}
      <p className="media-status">{item.status}{item.id === cover ? " · gallery cover" : ""}</p>
      {item.moderationNote ? <p className="muted">Review note: {item.moderationNote}</p> : null}
      {!["uploading", "failed"].includes(item.status) ? <details><summary>Edit image details</summary><MediaForm id={item.id} operation="metadata" label="Save image details">
        <label>Image type<select name="kind" defaultValue={item.kind}><option value="screenshot">Screenshot</option><option value="image">Product image</option></select></label>
        <label>Image description<input name="altText" required minLength={3} maxLength={200} defaultValue={item.altText} /></label>
        <label>Caption<textarea name="caption" maxLength={300} defaultValue={item.caption} rows={2} /></label><p className="form-note">Changed details return the image to review.</p>
      </MediaForm></details> : null}
      {item.status === "approved" && item.id !== cover ? <MediaForm id={item.id} operation="cover" label="Make gallery cover" /> : null}
      {item.status !== "uploading" ? <details><summary>Remove image</summary><p>This revokes access immediately and deletes the stored image. Upload it again if you change your mind.</p><MediaForm id={item.id} operation="remove" label="Permanently remove image" /></details> : <p className="form-note">An interrupted upload is cleaned up by the operator after one hour.</p>}
    </article>)}</div>
    {!items.length ? <p className="empty-copy">No images yet. Start with one clear screenshot of the main workflow.</p> : null}
  </section>;
}
