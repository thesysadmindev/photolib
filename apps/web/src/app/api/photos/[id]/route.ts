import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@photolib/shared";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const [photo] = await db
    .select()
    .from(schema.photos)
    .where(
      and(
        eq(schema.photos.id, params.id),
        eq(schema.photos.isPublic, true),
        eq(schema.photos.status, "ready"),
      ),
    )
    .limit(1);

  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tags = await db
    .select({ id: schema.tags.id, name: schema.tags.name, slug: schema.tags.slug })
    .from(schema.photoTags)
    .innerJoin(schema.tags, eq(schema.photoTags.tagId, schema.tags.id))
    .where(eq(schema.photoTags.photoId, photo.id));

  const albums = await db
    .select({ id: schema.albums.id, name: schema.albums.name, slug: schema.albums.slug })
    .from(schema.photoAlbums)
    .innerJoin(schema.albums, eq(schema.photoAlbums.albumId, schema.albums.id))
    .where(and(eq(schema.photoAlbums.photoId, photo.id), eq(schema.albums.isPublic, true)));

  return NextResponse.json({
    id: photo.id,
    title: photo.title,
    description: photo.description,
    takenAt: photo.takenAt,
    width: photo.width,
    height: photo.height,
    exif: photo.exif,
    previewUrl: `/api/photos/${photo.id}/preview`,
    downloadJpgUrl: `/api/photos/${photo.id}/download/jpg`,
    tags,
    albums,
  });
}
