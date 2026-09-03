import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@photolib/shared";
import { and, desc, eq, inArray, lt } from "drizzle-orm";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export async function GET(req: NextRequest) {
  const cursorParam = req.nextUrl.searchParams.get("cursor");
  const cursor = cursorParam ? new Date(cursorParam) : null;
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
    .where(
      and(
        eq(schema.photos.isPublic, true),
        eq(schema.photos.status, "ready"),
        cursor ? lt(schema.photos.uploadedAt, cursor) : undefined,
        tagFilter,
      ),
    )
    .orderBy(desc(schema.photos.uploadedAt))
    .limit(PAGE_SIZE);

  const nextCursor =
    rows.length === PAGE_SIZE ? rows[rows.length - 1]!.uploadedAt.toISOString() : null;

  return NextResponse.json({
    photos: rows.map((p) => ({
      ...p,
      thumbUrl: `/api/photos/${p.id}/thumb`,
    })),
    nextCursor,
  });
}
