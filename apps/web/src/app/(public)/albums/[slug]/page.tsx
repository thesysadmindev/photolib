import { notFound } from "next/navigation";
import { db, schema } from "@photolib/shared";
import { and, eq } from "drizzle-orm";
import { GalleryGrid } from "@/components/GalleryGrid";

export const dynamic = "force-dynamic";

async function getAlbum(slug: string) {
  const [album] = await db
    .select()
    .from(schema.albums)
    .where(and(eq(schema.albums.slug, slug), eq(schema.albums.isPublic, true)))
    .limit(1);
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
      <GalleryGrid baseUrl={`/api/albums/${album.slug}`} emptyMessage="This album is empty." />
    </div>
  );
}
