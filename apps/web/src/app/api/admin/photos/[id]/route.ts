import { NextRequest, NextResponse } from "next/server";
import { db, schema, deleteObject, enqueueConvertPhoto } from "@photolib/shared";
import { eq } from "drizzle-orm";
import { upsertTagsByName, setPhotoTags, setPhotoAlbums } from "@/lib/tags";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const [photo] = await db.select().from(schema.photos).where(eq(schema.photos.id, params.id)).limit(1);
  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tags = await db
    .select({ id: schema.tags.id, name: schema.tags.name })
    .from(schema.photoTags)
    .innerJoin(schema.tags, eq(schema.photoTags.tagId, schema.tags.id))
    .where(eq(schema.photoTags.photoId, params.id));

  const albumIds = await db
    .select({ albumId: schema.photoAlbums.albumId })
    .from(schema.photoAlbums)
    .where(eq(schema.photoAlbums.photoId, params.id));

  return NextResponse.json({
    photo,
    tags: tags.map((t) => t.name),
    albumIds: albumIds.map((a) => a.albumId),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json();

  if (body.action === "retry") {
    await db
      .update(schema.photos)
      .set({ status: "pending", errorMessage: null })
      .where(eq(schema.photos.id, params.id));
    await enqueueConvertPhoto(params.id);
    return NextResponse.json({ ok: true });
  }

  if (typeof body.isPublic === "boolean" && Object.keys(body).length === 1) {
    await db
      .update(schema.photos)
      .set({ isPublic: body.isPublic })
      .where(eq(schema.photos.id, params.id));
    return NextResponse.json({ ok: true });
  }

  // General metadata edit: title / description / tags / albums / isPublic together.
  const updates: Partial<typeof schema.photos.$inferInsert> = {};
  if (typeof body.title === "string") updates.title = body.title || null;
  if (typeof body.description === "string") updates.description = body.description || null;
  if (typeof body.isPublic === "boolean") updates.isPublic = body.isPublic;

  if (Object.keys(updates).length > 0) {
    await db.update(schema.photos).set(updates).where(eq(schema.photos.id, params.id));
  }

  if (Array.isArray(body.tags)) {
    const tagIds = await upsertTagsByName(body.tags.filter((t: unknown) => typeof t === "string"));
    await setPhotoTags(params.id, tagIds);
  }

  if (Array.isArray(body.albumIds)) {
    await setPhotoAlbums(
      params.id,
      body.albumIds.filter((a: unknown) => typeof a === "string"),
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const [photo] = await db
    .select()
    .from(schema.photos)
    .where(eq(schema.photos.id, params.id))
    .limit(1);

  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await Promise.all(
    [photo.rawStorageKey, photo.jpgStorageKey, photo.thumbStorageKey]
      .filter((key): key is string => Boolean(key))
      .map((key) => deleteObject(key).catch(() => undefined)),
  );

  await db.delete(schema.photos).where(eq(schema.photos.id, params.id));

  return NextResponse.json({ ok: true });
}
