import { NextResponse } from "next/server";
import { db, schema } from "@photolib/shared";
import { and, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select({
      id: schema.tags.id,
      name: schema.tags.name,
      slug: schema.tags.slug,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.photoTags)
    .innerJoin(schema.tags, eq(schema.photoTags.tagId, schema.tags.id))
    .innerJoin(schema.photos, eq(schema.photoTags.photoId, schema.photos.id))
    .where(and(eq(schema.photos.isPublic, true), eq(schema.photos.status, "ready")))
    .groupBy(schema.tags.id, schema.tags.name, schema.tags.slug)
    .orderBy(sql`count(*) desc`);

  return NextResponse.json({ tags: rows });
}
