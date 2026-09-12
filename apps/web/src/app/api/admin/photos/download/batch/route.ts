import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db, schema } from "@photolib/shared";
import { inArray } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { getClientIp } from "@/lib/ip";
import { appendRawFiles, appendWatermarkedImages, manifestEntry } from "@/lib/batchDownload";
import { createZipResponse } from "@/lib/zipStream";

export const dynamic = "force-dynamic";

const MAX_BATCH_SIZE = 500;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const fileType =
    body?.fileType === "raw" || body?.fileType === "jpg" || body?.fileType === "avif"
      ? body.fileType
      : null;
  const rawIds: unknown = body?.photoIds;
  const photoIds: string[] = Array.isArray(rawIds)
    ? Array.from(new Set(rawIds.filter((id): id is string => typeof id === "string")))
    : [];

  if (!fileType) {
    return NextResponse.json({ error: "fileType must be 'raw', 'jpg', or 'avif'" }, { status: 400 });
  }
  if (photoIds.length === 0) {
    return NextResponse.json({ error: "No photos selected" }, { status: 400 });
  }
  if (photoIds.length > MAX_BATCH_SIZE) {
    return NextResponse.json({ error: `Select at most ${MAX_BATCH_SIZE} photos at a time` }, { status: 400 });
  }

  // No isPublic/status filter here (unlike the public batch route): admins can bulk-download
  // RAW or JPG for any photo regardless of publish state, matching the single-file admin
  // download routes.
  const photos = await db.select().from(schema.photos).where(inArray(schema.photos.id, photoIds));
  if (photos.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") ?? undefined;

  return createZipResponse(async (archive) => {
    const result =
      fileType === "raw"
        ? await appendRawFiles(archive, photos, { ip, userAgent })
        : await appendWatermarkedImages(archive, photos, fileType, { ip, userAgent, downloadedByAdmin: true });
    const note = manifestEntry(result);
    if (note) archive.append(note, { name: "MANIFEST.txt" });
  }, `photolib-${fileType}.zip`);
}
