import { NextResponse } from "next/server";
import { db, schema, getObjectBuffer } from "@photolib/shared";
import { and, eq } from "drizzle-orm";

export async function servePhotoAsset(
  photoId: string,
  storageKeyColumn: "jpgStorageKey" | "thumbStorageKey",
): Promise<NextResponse> {
  const [photo] = await db
    .select()
    .from(schema.photos)
    .where(
      and(
        eq(schema.photos.id, photoId),
        eq(schema.photos.isPublic, true),
        eq(schema.photos.status, "ready"),
      ),
    )
    .limit(1);

  const key = photo?.[storageKeyColumn];
  if (!photo || !key) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bytes = await getObjectBuffer(key);

  // Safe to cache aggressively: these are the unwatermarked master assets,
  // identical for every viewer (unlike the per-download watermarked JPG).
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
