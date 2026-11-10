import type { Metadata } from "next";
import { CommunityDemo } from "@/components/community-demo";

export const metadata: Metadata = { title: "Community features demo", robots: { index: false, follow: false } };
export default function CommunityDemoPage() {
  return <section className="shell page-section collections-page"><header className="community-page-heading"><div><p className="eyebrow">BeforeBig playground</p><h1>A field guide, built together</h1><p className="muted">Try proposing an alternative, approving it, supporting it as another scout, and saving it to a collection.</p></div></header><p className="noindex-banner">Fictional records. Changes stay in this page and reset on reload. No account, database, or live moderation is used.</p><CommunityDemo /></section>;
}
