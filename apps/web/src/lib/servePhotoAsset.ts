import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db, schema, getObjectBuffer } from "@photolib/shared";
import { and, eq } from "drizzle-orm";

export interface AssetColumns {
  jpg: "jpgStorageKey" | "thumbStorageKey";
  avif: "avifStorageKey" | "avifThumbStorageKey";
}

export async function servePhotoAsset(
  req: NextRequest,
  photoId: string,
  columns: AssetColumns,
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

  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Content negotiation: serve AVIF only if the client asked for it and we have one
  // (photos converted before AVIF support existed, or mid-backfill, fall back to JPEG).
  const acceptsAvif = (req.headers.get("accept") ?? "").includes("image/avif");
  const avifKey = photo[columns.avif];
  const useAvif = acceptsAvif && Boolean(avifKey);

  const key = useAvif ? avifKey : photo[columns.jpg];
  if (!key) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bytes = await getObjectBuffer(key);

  // Safe to cache aggressively: these are the unwatermarked master assets,
  // identical for every viewer (unlike the per-download watermarked JPG/AVIF).
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": useAvif ? "image/avif" : "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      Vary: "Accept",
    },
  });
}
