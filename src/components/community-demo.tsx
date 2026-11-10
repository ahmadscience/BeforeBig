"use client";

import { useState } from "react";
import { recommendationSchema } from "@/lib/community";

export function CommunityDemo() {
  const [tab, setTab] = useState("alternatives");
  const [actor, setActor] = useState("scout");
  const [reason, setReason] = useState("For lightweight release planning, a focused checklist can be a useful alternative to a full project planner.");
  const [proposal, setProposal] = useState<{ author: string; reason: string; status: string; supporters: string[] } | null>(null);
  const [visibility, setVisibility] = useState("private");
  const [saved, setSaved] = useState<string[]>([]);
  const [removed, setRemoved] = useState(false);
  const [message, setMessage] = useState("");
  function notify(value: string) { setMessage(value); }
  return <div className="community-demo">
    <div className="community-row"><span className="tag">Browser-only sample</span><label className="demo-actor">Act as<select value={actor} onChange={(event) => { setActor(event.target.value); notify(""); }}><option value="scout">Scout · proposer</option><option value="other">Another scout</option><option value="moderator">Moderator</option></select></label></div>
    <div className="demo-tabs" role="tablist" aria-label="Community demo">
      {[["alternatives", "Alternatives"], ["collections", "Collections"], ["moderation", "Moderation"]].map(([value, label]) => <button role="tab" aria-selected={tab === value} aria-controls={"demo-" + value} id={"demo-tab-" + value} key={value} onClick={() => { setTab(value); notify(""); }} className={tab === value ? "button button-primary" : "button button-ghost"}>{label}</button>)}
    </div>
    <div role="status" aria-live="polite" className="demo-message">{message}</div>
    <section id="demo-alternatives" role="tabpanel" aria-labelledby="demo-tab-alternatives" hidden={tab !== "alternatives"}>
      <p className="eyebrow">TaskPilot</p><h2>Recommended alternatives</h2>
      {proposal?.status === "approved" ? <article className="collection-card"><h3>PatchKit</h3><p>{proposal.reason}</p><div className="community-row"><span>{proposal.supporters.length} supporters</span><button className="button button-ghost" onClick={() => {
        if (actor === proposal.author) return notify("Authors cannot support their own recommendation. Try acting as another scout.");
        const has = proposal.supporters.includes(actor);
        setProposal({ ...proposal, supporters: has ? proposal.supporters.filter((id) => id !== actor) : [...proposal.supporters, actor] }); notify(has ? "Support removed." : "Support added once for this account.");
      }}>{proposal.supporters.includes(actor) ? "Remove support" : "Support alternative"}</button><button className="button button-ghost" onClick={() => { if (removed) return notify("Restore your collection first."); setSaved([...new Set([...saved, "PatchKit"])]); notify("PatchKit saved to Next project. Open Collections to see it."); }}>Save to collection</button></div></article> : <p className="catalog-empty">No approved recommendations yet. Propose one, then review it in Moderation.</p>}
      <form className="community-form" onSubmit={(event) => {
        event.preventDefault(); if (proposal && proposal.author !== actor) return notify("Only the original proposer can revise this recommendation."); if (proposal && ["pending", "approved"].includes(proposal.status)) return notify("This alternative has already been proposed.");
        const parsed = recommendationSchema.safeParse({ sourceSlug: "taskpilot", targetSlug: "patchkit", reason });
        if (!parsed.success) return notify(parsed.error.issues[0].message);
        setProposal({ author: actor, reason: parsed.data.reason, status: "pending", supporters: [] }); notify("Submitted for moderation. The reason is not public yet.");
      }}><label>Why recommend PatchKit?<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={30} maxLength={1000} required rows={3} /></label><button className="button button-primary">Recommend alternative</button></form>
      {proposal && proposal.author === actor ? <div className="community-row"><span>Your proposal: {proposal.status}</span>{["pending", "approved"].includes(proposal.status) ? <button className="button button-ghost" onClick={() => { setProposal({ ...proposal, status: "withdrawn", supporters: [] }); notify("Recommendation withdrawn and support cleared."); }}>Withdraw</button> : null}</div> : null}
    </section>
    <section id="demo-collections" role="tabpanel" aria-labelledby="demo-tab-collections" hidden={tab !== "collections"}>
      <div className="community-row"><div><p className="eyebrow">Your collection</p><h2>Next project</h2></div><span className="tag">{removed ? "Removed" : visibility}</span></div>
      {removed ? <div className="catalog-empty"><p>The public link is hidden. Your shortlist can be restored.</p><button className="button button-primary" onClick={() => { setRemoved(false); notify("Collection restored with saved items intact."); }}>Restore collection</button></div> : <>
        <label className="demo-actor">Visibility<select value={visibility} onChange={(event) => { setVisibility(event.target.value); notify(event.target.value === "public" ? "Anyone with the collection link can see the title, description, and approved products." : "Only the owner can read this collection."); }}><option value="private">Private · only you</option><option value="public">Public · listed and shareable</option></select></label>
        <div className="community-list">{saved.map((name) => <article className="community-row" key={name}><strong>{name}</strong><button className="button button-ghost" onClick={() => { setSaved(saved.filter((value) => value !== name)); notify(name + " removed."); }}>Remove {name}</button></article>)}</div>
        {!saved.length ? <p className="catalog-empty">Your collection is empty. Save a sample product below.</p> : null}
        <div className="community-row">{["TaskPilot", "PatchKit", "ReplyRadar"].map((name) => <button className="button button-ghost" key={name} onClick={() => { setSaved([...new Set([...saved, name])]); notify(name + " saved. Duplicate saves keep one item."); }}>Save {name}</button>)}</div>
        <details className="community-details"><summary>Remove collection</summary><p>The collection is hidden immediately and remains restorable.</p><button className="button button-ghost" onClick={() => { setRemoved(true); notify("Collection removed from public view."); }}>Confirm removal</button></details>
      </>}
    </section>
    <section id="demo-moderation" role="tabpanel" aria-labelledby="demo-tab-moderation" hidden={tab !== "moderation"}>
      <p className="eyebrow">Review queue</p><h2>Alternative recommendations</h2>
      {proposal?.status === "pending" ? <article className="collection-card"><h3>PatchKit as an alternative to TaskPilot</h3><p>{proposal.reason}</p><div className="community-row">{["approved", "rejected"].map((decision) => <button key={decision} className="button button-ghost" onClick={() => { if (actor !== "moderator") return notify("Choose the Moderator role to review proposals."); if (proposal.author === actor) return notify("Another moderator must review your own recommendation."); setProposal({ ...proposal, status: decision }); notify(decision === "approved" ? "Approved. The alternative is now visible on the product record." : "Rejected. The proposal stays out of public results."); }}>{decision === "approved" ? "Approve alternative" : "Reject alternative"}</button>)}</div></article> : <p className="catalog-empty">No alternatives are waiting for review.</p>}
    </section>
  </div>;
}
