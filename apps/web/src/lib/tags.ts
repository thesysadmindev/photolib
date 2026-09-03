import { db, schema, slugify } from "@photolib/shared";
import { eq, inArray } from "drizzle-orm";

/**
 * Resolves a list of free-text tag names to tag ids, creating any tags that
 * don't already exist yet (matched case-insensitively on the slug).
 */
export async function upsertTagsByName(names: string[]): Promise<string[]> {
  const cleaned = Array.from(
    new Set(
      names
        .map((n) => n.trim())
        .filter((n) => n.length > 0)
        .map((n) => n.slice(0, 60)),
    ),
  );
  if (cleaned.length === 0) return [];

  const slugs = cleaned.map((name) => ({ name, slug: slugify(name) })).filter((t) => t.slug.length > 0);

  const existing = await db
    .select()
    .from(schema.tags)
    .where(
      inArray(
        schema.tags.slug,
        slugs.map((t) => t.slug),
      ),
    );

  const existingBySlug = new Map(existing.map((t) => [t.slug, t]));
  const toCreate = slugs.filter((t) => !existingBySlug.has(t.slug));

  const created = toCreate.length
    ? await db.insert(schema.tags).values(toCreate).onConflictDoNothing().returning()
    : [];

  // onConflictDoNothing means a concurrent insert could have won the race - re-fetch
  // for any slugs that didn't come back so we still return a complete id list.
  const createdBySlug = new Map(created.map((t) => [t.slug, t]));
  const missing = toCreate.filter((t) => !createdBySlug.has(t.slug));
  const refetched = missing.length
    ? await db
        .select()
        .from(schema.tags)
        .where(
          inArray(
            schema.tags.slug,
            missing.map((t) => t.slug),
          ),
        )
    : [];

  const allBySlug = new Map([
    ...existingBySlug,
    ...createdBySlug,
    ...refetched.map((t) => [t.slug, t] as const),
  ]);

  return slugs.map((t) => allBySlug.get(t.slug)!.id).filter(Boolean);
}

export async function setPhotoTags(photoId: string, tagIds: string[]): Promise<void> {
  await db.delete(schema.photoTags).where(eq(schema.photoTags.photoId, photoId));
  if (tagIds.length > 0) {
    await db.insert(schema.photoTags).values(tagIds.map((tagId) => ({ photoId, tagId })));
  }
}

export async function setPhotoAlbums(photoId: string, albumIds: string[]): Promise<void> {
  await db.delete(schema.photoAlbums).where(eq(schema.photoAlbums.photoId, photoId));
  if (albumIds.length > 0) {
    await db.insert(schema.photoAlbums).values(albumIds.map((albumId) => ({ photoId, albumId })));
  }
}
