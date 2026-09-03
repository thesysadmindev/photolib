import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db, schema, getObject } from "@photolib/shared";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { getClientIp } from "@/lib/ip";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [photo] = await db
    .select()
    .from(schema.photos)
    .where(eq(schema.photos.id, params.id))
    .limit(1);

  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.insert(schema.downloadEvents).values({
    photoId: photo.id,
    fileType: "raw",
    token: null,
    ipAddress: getClientIp(req),
    userAgent: req.headers.get("user-agent") ?? undefined,
    watermarkOk: null,
    downloadedByAdmin: true,
  });

  const object = await getObject(photo.rawStorageKey);
  // Stream straight through rather than buffering the whole (often 20-80MB) RAW file in memory.
  const stream = await object.Body!.transformToWebStream();

  return new NextResponse(stream as ReadableStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${photo.originalFilename.replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
