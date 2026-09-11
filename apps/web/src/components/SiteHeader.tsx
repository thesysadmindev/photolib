import Link from "next/link";
import { SITE_TITLE } from "@/lib/siteConfig";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-title">
          {SITE_TITLE}
        </Link>
        <nav className="site-nav">
          <Link href="/albums">Albums</Link>
          <Link href="/tags">Tags</Link>
          <Link href="/info">Info</Link>
          <Link href="/admin/login">Admin</Link>
        </nav>
      </div>
    </header>
  );
}
