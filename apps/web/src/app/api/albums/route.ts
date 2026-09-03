import { NextResponse } from "next/server";
import { db, schema } from "@photolib/shared";
import { and, desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const albumRows = await db
    .select()
    .from(schema.albums)
    .where(eq(schema.albums.isPublic, true))
    .orderBy(desc(schema.albums.createdAt));

  const albums = await Promise.all(
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
        const [cover] = await db
          .select({ thumbStorageKey: schema.photos.thumbStorageKey })
          .from(schema.photos)
          .where(eq(schema.photos.id, album.coverPhotoId))
          .limit(1);
        if (cover?.thumbStorageKey) coverThumbUrl = `/api/photos/${album.coverPhotoId}/thumb`;
      }
      if (!coverThumbUrl) {
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

      return {
        id: album.id,
        name: album.name,
        slug: album.slug,
        description: album.description,
        photoCount: count,
        coverThumbUrl,
      };
    }),
  );

  return NextResponse.json({ albums });
}
