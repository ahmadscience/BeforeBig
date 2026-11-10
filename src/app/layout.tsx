import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { GoogleAnalytics } from "@/components/google-analytics";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3247"),
  title: {
    default: "BeforeBig — discover products before they get big",
    template: "%s — BeforeBig",
  },
  description: "A calmer way to discover promising products early and build a verified public product record.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("beforebig-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()` }} />
      </head>
      <body>
        <GoogleAnalytics />
        <a className="skip-link" href="#main-content">Skip to content</a>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <footer className="site-footer">
          <div className="shell footer-inner">
            <span className="footer-brand"><span className="footer-mark">B/</span> BeforeBig</span>
            <nav aria-label="Footer navigation"><Link href="/today">Discover</Link><Link href="/submit">Submit</Link><Link href="/dashboard">For founders</Link><Link href="/privacy">Privacy</Link></nav>
            <span className="muted">Free demo · No paid ranking</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
