import type { Metadata } from "next";
import { PrivacyDemo } from "@/components/privacy-demo";
export const metadata:Metadata={title:"Privacy controls demo",robots:{index:false,follow:false}};
export default function PrivacyDemoPage(){return <section className="shell page-section privacy-page"><p className="eyebrow">BeforeBig playground</p><h1>Your data, with clear choices</h1><p className="catalog-notice">Fictional sample data. Simulate recent sign-in, inspect an export, and preview deletion consequences. No emails, files, accounts, analytics settings, or storage are changed.</p><PrivacyDemo /></section>;}
