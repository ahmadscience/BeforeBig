import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">B/</span>
          <span className="brand-word">BeforeBig</span>
        </Link>
        <nav className="nav-center" aria-label="Primary navigation">
          <Button asChild variant="ghost" size="sm"><Link href="/today">Discover</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link href="/compare">Compare</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link href="/dashboard">For founders</Link></Button>
        </nav>
        <div className="nav-links">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm"><Link href="/sign-in">Sign in</Link></Button>
          <Button asChild size="sm"><Link href="/submit"><span className="nav-cta-long">Submit product</span><span className="nav-cta-short">Submit</span><span aria-hidden="true">↗</span></Link></Button>
        </div>
      </div>
    </header>
  );
}
