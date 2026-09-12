import { NextRequest, NextResponse } from "next/server";
import { db, schema, getObjectBuffer } from "@photolib/shared";
import { and, eq } from "drizzle-orm";
import { getClientIp } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rateLimit";
import { watermarkEmbedLimiter } from "@/lib/concurrencyLimiter";
import { WatermarkServiceError } from "@/lib/watermarkClient";
import { embedWatermarkedDownload, recordDownloadWithRetry } from "@/lib/watermarkDownload";

export const dynamic = "force-dynamic";

// Mirrors download/jpg/route.ts exactly, except the final buffer is transcoded
// to AVIF - see embedWatermarkedDownload for why the watermark itself is still
// embedded in the JPEG domain. Available for any ready/public photo regardless
// of whether its stored AVIF master (avifStorageKey) exists yet, since this
// route only ever reads the JPEG master.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ip = getClientIp(req);

  const { allowed } = await checkRateLimit("download-avif", ip);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const [photo] = await db
    .select()
    .from(schema.photos)
    .where(
      and(
        eq(schema.photos.id, params.id),
        eq(schema.photos.isPublic, true),
        eq(schema.photos.status, "ready"),
      ),
    )
    .limit(1);

  if (!photo || !photo.jpgStorageKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userAgent = req.headers.get("user-agent") ?? undefined;

  const release = await watermarkEmbedLimiter.acquire();
  let watermarked: Buffer;
  try {
    const baseJpg = await getObjectBuffer(photo.jpgStorageKey);

    const result = await recordDownloadWithRetry({
      photoId: photo.id,
      fileType: "avif",
      ip,
      userAgent,
      downloadedByAdmin: false,
      produce: (token) => embedWatermarkedDownload(baseJpg, token, "avif"),
    });
    watermarked = result.buffer;
  } catch (err) {
    release();

    // Fail closed: never serve an unwatermarked file. Still log the failed
    // attempt (no token) so a dead watermark-svc is visible in the audit log.
    await db.insert(schema.downloadEvents).values({
      photoId: photo.id,
      fileType: "avif",
      token: null,
      ipAddress: ip,
      userAgent,
      watermarkOk: false,
      downloadedByAdmin: false,
    });

    const message =
      err instanceof WatermarkServiceError
        ? "Watermarking service is temporarily unavailable. Please try again shortly."
        : "Download failed. Please try again shortly.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
  release();

  const filename = `${photo.title ?? photo.originalFilename.replace(/\.[^.]+$/, "")}.avif`;

  return new NextResponse(new Uint8Array(watermarked), {
    headers: {
      "Content-Type": "image/avif",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      // Critical: this response embeds a unique per-request token, so it must
      // never be cached/reused across different downloaders.
      "Cache-Control": "no-store",
    },
  });
}
