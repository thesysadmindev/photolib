import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <nav className="admin-nav">
        <Link href="/admin/upload">Upload</Link>
        <Link href="/admin/photos">Manage photos</Link>
        <Link href="/admin/albums">Albums</Link>
        <Link href="/admin/lookup">Watermark lookup</Link>
        <span className="admin-nav-spacer" />
        <Link href="/">View site</Link>
        <SignOutButton />
      </nav>
      {children}
    </div>
  );
}
