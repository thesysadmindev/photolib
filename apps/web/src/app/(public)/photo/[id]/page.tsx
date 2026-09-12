import { notFound } from "next/navigation";
import Link from "next/link";
import { db, schema } from "@photolib/shared";
import { and, eq } from "drizzle-orm";
import { ExifTable } from "@/components/ExifTable";

export const dynamic = "force-dynamic";

async function getPhoto(id: string) {
  const [photo] = await db
    .select()
    .from(schema.photos)
    .where(
      and(
        eq(schema.photos.id, id),
        eq(schema.photos.isPublic, true),
        eq(schema.photos.status, "ready"),
      ),
    )
    .limit(1);
  if (!photo) return null;

  const tags = await db
    .select({ name: schema.tags.name, slug: schema.tags.slug })
    .from(schema.photoTags)
    .innerJoin(schema.tags, eq(schema.photoTags.tagId, schema.tags.id))
    .where(eq(schema.photoTags.photoId, photo.id));

  const albums = await db
    .select({ name: schema.albums.name, slug: schema.albums.slug })
    .from(schema.photoAlbums)
    .innerJoin(schema.albums, eq(schema.photoAlbums.albumId, schema.albums.id))
    .where(and(eq(schema.photoAlbums.photoId, photo.id), eq(schema.albums.isPublic, true)));

  return { photo, tags, albums };
}

export default async function PhotoDetailPage({ params }: { params: { id: string } }) {
  const result = await getPhoto(params.id);
  if (!result) notFound();
  const { photo, tags, albums } = result;

  return (
    <div className="container" style={{ marginTop: 32 }}>
      <a href="/" className="back-link">
        ← Back to gallery
      </a>

      <div className="photo-detail">
        <img
          src={`/api/photos/${photo.id}/preview`}
          alt={photo.title ?? "Photo"}
          className="photo-detail-image"
        />

        <div className="photo-detail-sidebar">
          <h1>{photo.title ?? "Untitled"}</h1>
          {photo.description && <p className="photo-detail-description">{photo.description}</p>}

          {(albums.length > 0 || tags.length > 0) && (
            <div className="chip-row">
              {albums.map((album) => (
                <Link key={album.slug} href={`/albums/${album.slug}`} className="chip">
                  📁 {album.name}
                </Link>
              ))}
              {tags.map((tag) => (
                <Link key={tag.slug} href={`/?tag=${encodeURIComponent(tag.slug)}`} className="chip">
                  #{tag.name}
                </Link>
              ))}
            </div>
          )}

          <div className="btn-row">
            <a className="btn" href={`/api/photos/${photo.id}/download/jpg`}>
              Download JPG
            </a>
            <a className="btn" href={`/api/photos/${photo.id}/download/avif`}>
              Download AVIF
            </a>
          </div>

          <div className="detail-card">
            <h2>Photo details</h2>
            <ExifTable exif={photo.exif as Record<string, unknown> | null} />
          </div>
        </div>
      </div>
    </div>
  );
}
