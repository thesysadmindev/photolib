import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db, schema } from "@photolib/shared";
import { eq } from "drizzle-orm";
import { GalleryGrid } from "@/components/GalleryGrid";

export const dynamic = "force-dynamic";

async function getAlbum(slug: string) {
  // Unpublished albums are unlisted (excluded from the /albums index) but still
  // reachable by anyone with the direct slug link - only the listing is gated.
  const [album] = await db.select().from(schema.albums).where(eq(schema.albums.slug, slug)).limit(1);
  return album ?? null;
}

export default async function AlbumDetailPage({ params }: { params: { slug: string } }) {
  const album = await getAlbum(params.slug);
  if (!album) notFound();

  return (
    <div className="container">
      <a href="/albums" className="back-link" style={{ marginTop: 32, display: "inline-flex" }}>
        ← All albums
      </a>
      <div className="page-header">
        <div>
          <h1>{album.name}</h1>
          {album.description && <p>{album.description}</p>}
        </div>
      </div>
      <Suspense fallback={null}>
        <GalleryGrid baseUrl={`/api/albums/${album.slug}`} emptyMessage="This album is empty." />
      </Suspense>
    </div>
  );
}
