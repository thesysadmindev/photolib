import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@photolib/shared";
import { eq } from "drizzle-orm";
import { extractWatermark, WatermarkServiceError } from "@/lib/watermarkClient";
import { avifToJpeg } from "@/lib/imageTranscode";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  let bytes: Buffer = Buffer.from(await file.arrayBuffer());

  // The watermark service only ever operates on JPEG bytes - a leaked file
  // could now be an AVIF download, so transcode it before extraction.
  const isAvif = file.type === "image/avif" || file.name.toLowerCase().endsWith(".avif");
  if (isAvif) {
    try {
      bytes = await avifToJpeg(bytes);
    } catch {
      return NextResponse.json({ error: "Could not decode AVIF file" }, { status: 400 });
    }
  }

  let result;
  try {
    result = await extractWatermark(bytes);
  } catch (err) {
    const message =
      err instanceof WatermarkServiceError
        ? "Watermarking service is temporarily unavailable."
        : "Extraction failed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  if (!result.token) {
    return NextResponse.json({ match: false, reason: "No watermark detected" });
  }

  const [event] = await db
    .select()
    .from(schema.downloadEvents)
    .where(eq(schema.downloadEvents.token, result.token))
    .limit(1);

  if (!event) {
    return NextResponse.json({
      match: false,
      reason: "Token extracted but no matching download record found",
      extractedToken: result.token,
      confidence: result.confidence,
    });
  }

  const [photo] = await db
    .select({
      id: schema.photos.id,
      title: schema.photos.title,
      originalFilename: schema.photos.originalFilename,
    })
    .from(schema.photos)
    .where(eq(schema.photos.id, event.photoId))
    .limit(1);

  return NextResponse.json({
    match: true,
    confidence: result.confidence,
    photo,
    ipAddress: event.ipAddress,
    downloadedAtUtc: event.downloadedAt,
    userAgent: event.userAgent,
  });
}
