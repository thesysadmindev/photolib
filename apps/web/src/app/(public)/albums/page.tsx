import Link from "next/link";
import { db, schema } from "@photolib/shared";
import { and, desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function getAlbums() {
  const albumRows = await db
    .select()
    .from(schema.albums)
    .where(eq(schema.albums.isPublic, true))
    .orderBy(desc(schema.albums.createdAt));

  return Promise.all(
    albumRows.map(async (album) => {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.photoAlbums)
        .innerJoin(schema.photos, eq(schema.photoAlbums.photoId, schema.photos.id))
        .where(
          and(
            eq(schema.photoAlbums.albumId, album.id),
            eq(schema.photos.isPublic, true),
            eq(schema.photos.status, "ready"),
          ),
        );

      let coverThumbUrl: string | null = null;
      if (album.coverPhotoId) {
        coverThumbUrl = `/api/photos/${album.coverPhotoId}/thumb`;
      } else {
        const [fallback] = await db
          .select({ photoId: schema.photoAlbums.photoId })
          .from(schema.photoAlbums)
          .innerJoin(schema.photos, eq(schema.photoAlbums.photoId, schema.photos.id))
          .where(
            and(
              eq(schema.photoAlbums.albumId, album.id),
              eq(schema.photos.isPublic, true),
              eq(schema.photos.status, "ready"),
            ),
          )
          .orderBy(desc(schema.photoAlbums.addedAt))
          .limit(1);
        if (fallback) coverThumbUrl = `/api/photos/${fallback.photoId}/thumb`;
      }

      return { ...album, photoCount: count, coverThumbUrl };
    }),
  );
}

export default async function AlbumsPage() {
  const albums = await getAlbums();

  return (
    <div className="container">
      <div className="page-header" style={{ marginTop: 32 }}>
        <div>
          <h1>Albums</h1>
          <p>Browse photo collections.</p>
        </div>
      </div>

      {albums.length === 0 ? (
        <div className="empty-state">No albums published yet.</div>
      ) : (
        <div className="gallery-grid">
          {albums.map((album) => (
            <Link key={album.id} href={`/albums/${album.slug}`} className="gallery-card">
              <div className="gallery-card-image">
                {album.coverThumbUrl && (
                  <img src={album.coverThumbUrl} alt={album.name} loading="lazy" />
                )}
              </div>
              <div className="gallery-card-caption">
                <div className="gallery-card-title">{album.name}</div>
                <div className="gallery-card-meta">
                  {album.photoCount} photo{album.photoCount === 1 ? "" : "s"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
