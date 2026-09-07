import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@photolib/shared";
import { and, desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  // Unpublished albums are unlisted (excluded from /api/albums) but still reachable by
  // anyone with the direct slug link - only the listing is gated on isPublic, not access.
  const [album] = await db
    .select()
    .from(schema.albums)
    .where(eq(schema.albums.slug, params.slug))
    .limit(1);

  if (!album) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pageParam = Number(req.nextUrl.searchParams.get("page"));
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1;

  const where = and(
    eq(schema.photoAlbums.albumId, album.id),
    eq(schema.photos.isPublic, true),
    eq(schema.photos.status, "ready"),
  );

  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.photoAlbums)
    .innerJoin(schema.photos, eq(schema.photoAlbums.photoId, schema.photos.id))
    .where(where);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

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
    .where(where)
    .orderBy(desc(schema.photoAlbums.addedAt))
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);

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
    page: safePage,
    pageSize: PAGE_SIZE,
    totalCount,
    totalPages,
  });
}
