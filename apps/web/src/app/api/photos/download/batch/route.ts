import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@photolib/shared";
import { and, eq, inArray } from "drizzle-orm";
import { getClientIp } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rateLimit";
import { appendWatermarkedJpgs, manifestEntry } from "@/lib/batchDownload";
import { createZipResponse } from "@/lib/zipStream";

export const dynamic = "force-dynamic";

const MAX_BATCH_SIZE = 50;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const { allowed } = await checkRateLimit("download-jpg-batch", ip);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const rawIds: unknown = body?.photoIds;
  const photoIds: string[] = Array.isArray(rawIds)
    ? Array.from(new Set(rawIds.filter((id): id is string => typeof id === "string")))
    : [];

  if (photoIds.length === 0) {
    return NextResponse.json({ error: "No photos selected" }, { status: 400 });
  }
  if (photoIds.length > MAX_BATCH_SIZE) {
    return NextResponse.json({ error: `Select at most ${MAX_BATCH_SIZE} photos at a time` }, { status: 400 });
  }

  const photos = await db
    .select()
    .from(schema.photos)
    .where(
      and(
        inArray(schema.photos.id, photoIds),
        eq(schema.photos.isPublic, true),
        eq(schema.photos.status, "ready"),
      ),
    );

  if (photos.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userAgent = req.headers.get("user-agent") ?? undefined;

  return createZipResponse(async (archive) => {
    const result = await appendWatermarkedJpgs(archive, photos, { ip, userAgent, downloadedByAdmin: false });
    const note = manifestEntry(result);
    if (note) archive.append(note, { name: "MANIFEST.txt" });
  }, "photos.zip");
}
