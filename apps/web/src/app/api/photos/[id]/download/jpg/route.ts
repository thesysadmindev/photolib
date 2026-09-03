import { NextRequest, NextResponse } from "next/server";
import { db, schema, getObjectBuffer } from "@photolib/shared";
import { and, eq } from "drizzle-orm";
import { getClientIp } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rateLimit";
import { watermarkEmbedLimiter } from "@/lib/concurrencyLimiter";
import { embedWatermark, WatermarkServiceError } from "@/lib/watermarkClient";
import { generateWatermarkToken } from "@/lib/token";

export const dynamic = "force-dynamic";

const MAX_TOKEN_ATTEMPTS = 3;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ip = getClientIp(req);

  const { allowed } = await checkRateLimit("download-jpg", ip);
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
  let token: string;
  try {
    const baseJpg = await getObjectBuffer(photo.jpgStorageKey);

    // The token space (62^8) makes a collision astronomically unlikely, but the
    // DB's unique constraint is the actual guarantee - retry on the rare clash
    // rather than trusting probability alone.
    let attempt = 0;
    for (;;) {
      attempt += 1;
      token = generateWatermarkToken();
      watermarked = await embedWatermark(baseJpg, token);
      try {
        await db.insert(schema.downloadEvents).values({
          photoId: photo.id,
          fileType: "jpg",
          token,
          ipAddress: ip,
          userAgent,
          watermarkOk: true,
          downloadedByAdmin: false,
        });
        break;
      } catch (insertErr) {
        const isUniqueViolation = (insertErr as { code?: string }).code === "23505";
        if (!isUniqueViolation || attempt >= MAX_TOKEN_ATTEMPTS) throw insertErr;
      }
    }
  } catch (err) {
    release();

    // Fail closed: never serve an unwatermarked file. Still log the failed
    // attempt (no token) so a dead watermark-svc is visible in the audit log.
    await db.insert(schema.downloadEvents).values({
      photoId: photo.id,
      fileType: "jpg",
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

  const filename = `${photo.title ?? photo.originalFilename.replace(/\.[^.]+$/, "")}.jpg`;

  return new NextResponse(new Uint8Array(watermarked), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      // Critical: this response embeds a unique per-request token, so it must
      // never be cached/reused across different downloaders.
      "Cache-Control": "no-store",
    },
  });
}
