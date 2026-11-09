import type { Metadata } from "next";
import { SubmitForm } from "@/components/submit-form";

export const metadata: Metadata = { title: "Add your product" };

export default function SubmitPage() {
  return <section className="shell narrow-section"><div className="page-kicker">For founders</div><h1>Start with one<br /><em>good record.</em></h1><p className="page-lede">BeforeBig is free while we shape the network. Start with a public URL and edit the first draft before it goes into review.</p><SubmitForm /><div className="trust-note"><span>✳</span><p><strong>What happens next?</strong><br />After Turso saving is configured, your signed-in submission receives a public noindex preview. You can edit it immediately; DNS verification and moderation control when it becomes indexable.</p></div></section>;
}
