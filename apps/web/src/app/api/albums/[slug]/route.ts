import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@photolib/shared";
import { and, desc, eq, lt } from "drizzle-orm";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const [album] = await db
    .select()
    .from(schema.albums)
    .where(and(eq(schema.albums.slug, params.slug), eq(schema.albums.isPublic, true)))
    .limit(1);

  if (!album) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cursorParam = req.nextUrl.searchParams.get("cursor");
  const cursor = cursorParam ? new Date(cursorParam) : null;

  const rows = await db
    .select({
      id: schema.photos.id,
      title: schema.photos.title,
      takenAt: schema.photos.takenAt,
      cameraMake: schema.photos.cameraMake,
      cameraModel: schema.photos.cameraModel,
      addedAt: schema.photoAlbums.addedAt,
    })
    .from(schema.photoAlbums)
    .innerJoin(schema.photos, eq(schema.photoAlbums.photoId, schema.photos.id))
    .where(
      and(
        eq(schema.photoAlbums.albumId, album.id),
        eq(schema.photos.isPublic, true),
        eq(schema.photos.status, "ready"),
        cursor ? lt(schema.photoAlbums.addedAt, cursor) : undefined,
      ),
    )
    .orderBy(desc(schema.photoAlbums.addedAt))
    .limit(PAGE_SIZE);

  const nextCursor = rows.length === PAGE_SIZE ? rows[rows.length - 1]!.addedAt.toISOString() : null;

  return NextResponse.json({
    album: {
      id: album.id,
      name: album.name,
      slug: album.slug,
      description: album.description,
    },
    photos: rows.map((p) => ({
      id: p.id,
      title: p.title,
      takenAt: p.takenAt,
      cameraMake: p.cameraMake,
      cameraModel: p.cameraModel,
      thumbUrl: `/api/photos/${p.id}/thumb`,
    })),
    nextCursor,
  });
}
