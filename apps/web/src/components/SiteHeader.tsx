import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-title">
          Photo Library
        </Link>
        <nav className="site-nav">
          <Link href="/albums">Albums</Link>
          <Link href="/tags">Tags</Link>
          <Link href="/admin/login">Admin</Link>
        </nav>
      </div>
    </header>
  );
}
