import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { db, schema, rawKey, putObjectFromPath, enqueueConvertPhoto } from "@photolib/shared";
import { eq } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { isRawExtension, extensionOf } from "@/lib/rawFormats";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_SIZE_MB ?? "100") * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const title = formData.get("title");
  const description = formData.get("description");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (!isRawExtension(file.name)) {
    return NextResponse.json(
      { error: `Unsupported file extension: ${extensionOf(file.name)}` },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const photoId = randomUUID();
  const tempPath = path.join(os.tmpdir(), `photolib-upload-${photoId}${extensionOf(file.name)}`);
  const hash = createHash("sha256");

  try {
    await pipeline(
      Readable.fromWeb(file.stream() as import("node:stream/web").ReadableStream<Uint8Array>),
      async function* (source: AsyncIterable<Uint8Array>) {
        for await (const chunk of source) {
          hash.update(chunk);
          yield chunk;
        }
      },
      fs.createWriteStream(tempPath),
    );

    const sha256 = hash.digest("hex");

    const [existing] = await db
      .select({ id: schema.photos.id })
      .from(schema.photos)
      .where(eq(schema.photos.rawSha256, sha256))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "Duplicate upload", photoId: existing.id },
        { status: 409 },
      );
    }

    const storageKey = rawKey(photoId, file.name);
    await putObjectFromPath(storageKey, tempPath, "application/octet-stream");

    await db.insert(schema.photos).values({
      id: photoId,
      title: typeof title === "string" && title.length > 0 ? title : null,
      description: typeof description === "string" && description.length > 0 ? description : null,
      originalFilename: file.name,
      rawFormat: extensionOf(file.name).slice(1).toUpperCase(),
      rawStorageKey: storageKey,
      rawSha256: sha256,
      status: "pending",
      uploadedBy: session.user.id as string,
    });

    await enqueueConvertPhoto(photoId);

    return NextResponse.json({ photoId }, { status: 201 });
  } finally {
    await fs.promises.rm(tempPath, { force: true });
  }
}
