import { db, schema, slugify } from "@photolib/shared";
import { eq } from "drizzle-orm";

export async function generateUniqueAlbumSlug(name: string): Promise<string> {
  const base = slugify(name) || "album";
  let candidate = base;
  let suffix = 2;

  for (;;) {
    const [existing] = await db
      .select({ id: schema.albums.id })
      .from(schema.albums)
      .where(eq(schema.albums.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}
