"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AccountState } from "@/lib/account";

export function AccountControls({fresh,sessions,products}:{fresh:boolean;sessions:number;products:{name:string;shared:boolean;role:string;status:string}[]}) {
  const router=useRouter();
  const [state,setState]=useState<AccountState>({});const [pending,setPending]=useState(false);const [confirm,setConfirm]=useState("");const [understood,setUnderstood]=useState(false);const [disposition,setDisposition]=useState("remove");const [deleted,setDeleted]=useState(false);
  async function request(operation:string,input?:unknown){
    setPending(true);setState({});
    try{
      const response=await fetch("/api/account/"+operation,{method:"POST",headers:{"Content-Type":"application/json"},body:input?JSON.stringify(input):undefined});
      if(!response.ok){const result=await response.json();setState({error:result.error||"Request failed. Try again later."});return;}
      if(operation==="export"){
        const blob=await response.blob();const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download="beforebig-account.json";anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setState({message:"JSON export downloaded. Images are separate authenticated downloads listed in the file; save them before deletion."});
      }else{const result=await response.json();setState({message:result.message+(result.imagesPendingCleanup?` ${result.imagesPendingCleanup} images await operator cleanup.`:"")});if(operation==="delete"){setDeleted(true);try{sessionStorage.removeItem("beforebig.analytics.session");}catch{/* Browser storage is optional. */}window.location.replace("/privacy?account=deleted");}if(operation==="sessions")router.refresh();}
    }catch{setState({error:operation==="delete"?"Connection interrupted. Reload to check whether deletion completed before trying again.":"Request interrupted. Try again later."});}finally{setPending(false);}
  }
  if(deleted)return <section className="panel privacy-panel"><h2>Account deleted</h2><p role="status">{state.message}</p><p className="muted">There is no account recovery. Backups and previously downloaded copies follow the instance operator’s retention policy.</p><Link href="/privacy" prefetch={false} className="button button-ghost">Return to privacy overview →</Link></section>;
  return <div className="privacy-stack">
    {!fresh?<p className="privacy-notice">For your security, <Link href="/sign-in?reauthenticate=1&returnTo=/settings/privacy" prefetch={false}>sign in again</Link> before exporting, signing out other sessions, or deleting. The confirmation window lasts 15 minutes.</p>:<p className="privacy-notice">Recent sign-in confirmed. Sensitive actions are available for 15 minutes after sign-in. <Link href="/sign-in?reauthenticate=1&returnTo=/settings/privacy" prefetch={false}>Confirm again</Link></p>}
    {state.error?<p className="form-error" role="alert">{state.error}</p>:null}{state.message?<p className="form-success" role="status">{state.message}</p>:null}
    <section className="panel privacy-panel"><p className="eyebrow">Take a copy</p><h2>Export your account data</h2><p>Download your profile, product memberships, collections (including removed ones), contributions, and image metadata as JSON. Other users’ private content and authentication secrets are excluded.</p><p className="muted">Image bytes are separate downloads listed in the export. Download them before deleting your account. Exports over 2 MiB or 5,000 rows per section require operator assistance; nothing is silently truncated.</p><button className="button button-primary" disabled={!fresh||pending} onClick={()=>request("export")}>Download account JSON</button></section>
    <section className="panel privacy-panel"><p className="eyebrow">Account access</p><h2>{sessions} active {sessions===1?"session":"sessions"}</h2><p>Sign out every other session. This browser stays signed in. Account deletion signs out every session, including this one.</p><button className="button button-ghost" disabled={!fresh||pending||sessions<2} onClick={()=>request("sessions")}>Sign out other sessions</button></section>
    <section className="panel privacy-panel privacy-danger"><p className="eyebrow">Permanent removal</p><h2>Delete your account</h2><p>Your profile, sign-in links, sessions, collections, reviews, recommendations, reactions, authored updates, and uploads will be removed. Image URLs stop working immediately; failed storage deletion is retried by the operator.</p>
      <fieldset disabled={pending||!fresh}><legend>Products where you are the only member</legend><label className="privacy-choice"><input type="radio" name="products" checked={disposition==="remove"} onChange={()=>setDisposition("remove")} /><span>Remove my unshared product records and their linked content.</span></label><label className="privacy-choice"><input type="radio" name="products" checked={disposition==="keep"} onChange={()=>setDisposition("keep")} /><span>Keep public records as unclaimed. Their descriptions, facts, and other people’s contributions remain public. My uploads and personal contributions are removed. Private/unlisted unshared records are deleted.</span></label></fieldset>
      {products.length?<details><summary>Review {products.length} product memberships</summary><ul>{products.map((product,index)=><li key={index}><strong>{product.name}</strong> — {product.role}, {product.status}. {product.shared?"Shared: record stays for collaborators.":product.role==="owner"?"Your unshared record: follows the choice above.":"Editor access: record stays."}</li>)}</ul></details>:null}
      <p className="muted">Shared records and product-level facts remain for collaborators. Losing the last owner clears verification; no ownership is transferred. Anonymous analytics/security logs cannot generally be linked to your account. Operator backups and external copies are not erased by this action.</p>
      <label className="privacy-choice"><input type="checkbox" checked={understood} onChange={event=>setUnderstood(event.target.checked)} disabled={pending||!fresh} /><span>I understand removal is permanent, reviewed the retained data, and saved anything I need.</span></label>
      <label className="privacy-confirm">Type DELETE to confirm<input value={confirm} onChange={event=>setConfirm(event.target.value)} autoComplete="off" spellCheck={false} disabled={pending||!fresh} /></label>
      <button className="button button-ghost" disabled={!fresh||pending||confirm!=="DELETE"||!understood} onClick={()=>request("delete",{confirmation:confirm,understood,products:disposition})}>{pending?"Working…":"Permanently delete my account"}</button>
    </section>
  </div>;
}
