import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@photolib/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export async function GET(req: NextRequest) {
  const pageParam = Number(req.nextUrl.searchParams.get("page"));
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1;
  const tagSlug = req.nextUrl.searchParams.get("tag");

  const tagFilter = tagSlug
    ? inArray(
        schema.photos.id,
        db
          .select({ id: schema.photoTags.photoId })
          .from(schema.photoTags)
          .innerJoin(schema.tags, eq(schema.photoTags.tagId, schema.tags.id))
          .where(eq(schema.tags.slug, tagSlug)),
      )
    : undefined;

  const where = and(eq(schema.photos.isPublic, true), eq(schema.photos.status, "ready"), tagFilter);

  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.photos)
    .where(where);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const rows = await db
    .select({
      id: schema.photos.id,
      title: schema.photos.title,
      takenAt: schema.photos.takenAt,
      uploadedAt: schema.photos.uploadedAt,
      cameraMake: schema.photos.cameraMake,
      cameraModel: schema.photos.cameraModel,
      width: schema.photos.width,
      height: schema.photos.height,
    })
    .from(schema.photos)
    .where(where)
    .orderBy(desc(schema.photos.uploadedAt))
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);

  return NextResponse.json({
    photos: rows.map((p) => ({
      ...p,
      thumbUrl: `/api/photos/${p.id}/thumb`,
    })),
    page: safePage,
    pageSize: PAGE_SIZE,
    totalCount,
    totalPages,
  });
}
