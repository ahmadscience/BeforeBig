import type { Metadata } from "next";
import { MediaDemo } from "@/components/media-demo";
export const metadata: Metadata = {title:"Product media demo",robots:{index:false,follow:false}};
export default function MediaDemoPage() {
  return <section className="shell page-section taxonomy-directory"><p className="eyebrow">BeforeBig playground</p><h1>A closer look at the product</h1><p className="catalog-notice">Fictional sample images. This browser-only playground demonstrates upload review, private previews, cover selection, and removal. No files, accounts, or storage are changed; actions reset on reload.</p><MediaDemo /></section>;
}
