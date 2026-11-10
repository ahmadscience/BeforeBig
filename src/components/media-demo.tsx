"use client";
import { useState } from "react";
import { MediaImage } from "@/components/media-image";
import type { MediaItem } from "@/lib/media";

const samples: MediaItem[] = [
  {id:"board",src:"/demo-media/board.webp",altText:"Fictional Fieldnote project board with task columns",caption:"The project board, from first idea to done.",kind:"screenshot",width:1200,height:750,status:"approved",position:0},
  {id:"activity",src:"/demo-media/activity.webp",altText:"Fictional Fieldnote activity report with completed tasks by day",caption:"A weekly view of completed work.",kind:"screenshot",width:1200,height:750,status:"pending",position:1},
];
export function MediaDemo() {
  const [items,setItems]=useState<MediaItem[]>([samples[0]]); const [role,setRole]=useState("founder"); const [message,setMessage]=useState("One approved screenshot is already in the gallery.");
  const [selected,setSelected]=useState("activity");const [caption,setCaption]=useState(samples[1].caption);const [rights,setRights]=useState(false); const [alt,setAlt]=useState(samples[1].altText);
  const visible=role === "visitor" ? items.filter(item=>item.status === "approved") : items;
  function upload() {
    if(!rights) {setMessage("Confirm publication rights before uploading the sample.");return;}
    if(alt.trim().length<3) {setMessage("Describe the image in at least 3 characters.");return;}
    if(items.some(item=>item.id===selected)) {setMessage("This sample is already in the gallery. Remove it to try again.");return;}
    const sample=samples.find(item=>item.id===selected)!;setItems([...items,{...sample,caption:caption.trim(),altText:alt.trim(),status:"pending",position:items.length}]);setMessage("Sample uploaded for review. Visitors cannot see it yet.");setRights(false);
  }
  function changeStatus(id:string,status:string) {setItems(items.map(item=>item.id===id?{...item,status}:item));setMessage(status === "approved"?"Sample approved by a separate moderator. It is now public.":"Sample rejected. It is hidden from visitors.");}
  return <div className="media-demo">
    <div className="media-demo-toolbar"><div><p className="eyebrow">Fictional product</p><h2>Fieldnote <span className="muted">/ gallery</span></h2></div><label>Preview as<select value={role} onChange={event=>setRole(event.target.value)}><option value="founder">Founder</option><option value="moderator">Separate moderator</option><option value="visitor">Public visitor</option></select></label></div>
    <p role="status" className="media-demo-message">{message}</p>
    {role === "founder" ? <div className="media-demo-upload"><div><p className="eyebrow">Add a screenshot</p><h3>Show the workflow</h3><p className="muted">PNG, JPEG, WebP · 4 MiB max · six images per product</p><p className="form-note">This playground uses bundled samples. Live uploads verify and re-encode file contents on the server.</p></div><div className="media-form">
      <label>Sample image<select value={selected} onChange={event=>{const sample=samples.find(item=>item.id===event.target.value)!;setSelected(sample.id);setCaption(sample.caption);setAlt(sample.altText);}}><option value="activity">Weekly activity screenshot</option><option value="board">Project board screenshot</option></select></label>
      <label>Image description<input value={alt} onChange={event=>setAlt(event.target.value)} maxLength={200} minLength={3} required /></label><label>Caption<input value={caption} onChange={event=>setCaption(event.target.value)} maxLength={300} /></label>
      <label className="media-rights"><input type="checkbox" checked={rights} onChange={event=>setRights(event.target.checked)} /><span>I have publication rights and checked for private information.</span></label>
      <div className="community-row"><button className="button button-primary" onClick={upload}>Upload sample for review</button><button className="button button-ghost" onClick={()=>setMessage("SVG blocked: only real, non-animated PNG, JPEG, and WebP images are accepted.")}>Try blocked SVG</button></div>
    </div></div> : null}
    <div className="block-heading"><h3>{role === "visitor"?"Public gallery":"Manage images"}</h3><span className="muted">{visible.length} {visible.length===1?"image":"images"}{role === "founder"?" / 6 slots":""}</span></div>
    <div className={role === "visitor"?"media-gallery":"media-manager-grid"}>{visible.map((item,index)=><figure className="media-demo-item" key={item.id}>
      <MediaImage item={item} /><figcaption><p className="media-status">{item.status}{item.status==="approved"&&item.id===items.find(image=>image.status==="approved")?.id?" · gallery cover":""}</p><h3>{item.id==="board"?"Project board":"Weekly activity"}</h3><p>{item.caption}</p></figcaption>
      {role === "moderator"?<div className="community-row"><button className="button button-ghost" onClick={()=>changeStatus(item.id,"approved")} disabled={item.status==="approved"}>Approve image</button><button className="button button-ghost" onClick={()=>changeStatus(item.id,"rejected")} disabled={item.status==="rejected"}>Reject / hide</button></div>:null}
      {role === "founder" && item.status==="approved" && index>0?<button className="button button-ghost" onClick={()=>{setItems([item,...items.filter(image=>image.id!==item.id)]);setMessage("Gallery cover changed.");}}>Make gallery cover</button>:null}
      {role!=="visitor"?<details><summary>Remove image</summary><p className="form-note">Removal revokes access before deleting private bytes.</p><button className="button button-ghost" onClick={()=>{setItems(items.filter(image=>image.id!==item.id));setMessage("Sample removed. Its gallery access is revoked.");}}>Confirm removal</button></details>:null}
    </figure>)}</div>
    {!visible.length?<p className="empty-copy">{role==="visitor"?"No approved images are public yet.":"No images in the gallery yet."}</p>:null}
  </div>;
}
