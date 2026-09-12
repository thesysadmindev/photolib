import type { Archiver } from "archiver";
import { Readable } from "node:stream";
import { db, schema, getObject, getObjectBuffer } from "@photolib/shared";
import { watermarkEmbedLimiter } from "./concurrencyLimiter";
import {
  embedWatermarkedDownload,
  recordDownloadWithRetry,
  type DownloadFormat,
  type Photo,
} from "./watermarkDownload";

export interface BatchResult {
  succeeded: string[];
  failed: string[];
}

function sanitizeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "photo";
}

/** Returns a namer that de-dupes filenames within one zip (title collisions are common). */
function nameFactory() {
  const used = new Set<string>();
  return (base: string, ext: string) => {
    const clean = sanitizeName(base);
    let name = `${clean}.${ext}`;
    let n = 2;
    while (used.has(name)) {
      name = `${clean}-${n}.${ext}`;
      n += 1;
    }
    used.add(name);
    return name;
  };
}

/**
 * Watermarks each photo (a fresh token per photo, same as the single-file
 * download routes) in the requested format and appends it to the zip as it
 * completes, logging one download_events row per photo either way. Fails
 * closed per-photo: a photo that can't be watermarked is left out of the zip,
 * not served unwatermarked.
 */
export async function appendWatermarkedImages(
  archive: Archiver,
  photos: Photo[],
  format: DownloadFormat,
  opts: { ip: string; userAgent: string | undefined; downloadedByAdmin: boolean },
): Promise<BatchResult> {
  const makeName = nameFactory();
  const succeeded: string[] = [];
  const failed: string[] = [];

  await Promise.all(
    photos.map(async (photo) => {
      const label = photo.title ?? photo.originalFilename;
      if (!photo.jpgStorageKey) {
        failed.push(label);
        return;
      }

      const release = await watermarkEmbedLimiter.acquire();
      try {
        const baseJpg = await getObjectBuffer(photo.jpgStorageKey);

        const { buffer } = await recordDownloadWithRetry({
          photoId: photo.id,
          fileType: format,
          ip: opts.ip,
          userAgent: opts.userAgent,
          downloadedByAdmin: opts.downloadedByAdmin,
          produce: (token) => embedWatermarkedDownload(baseJpg, token, format),
        });

        archive.append(buffer, {
          name: makeName(photo.title ?? photo.originalFilename.replace(/\.[^.]+$/, ""), format),
        });
        succeeded.push(label);
      } catch {
        failed.push(label);
        await db
          .insert(schema.downloadEvents)
          .values({
            photoId: photo.id,
            fileType: format,
            token: null,
            ipAddress: opts.ip,
            userAgent: opts.userAgent,
            watermarkOk: false,
            downloadedByAdmin: opts.downloadedByAdmin,
          })
          .catch(() => undefined);
      } finally {
        release();
      }
    }),
  );

  return { succeeded, failed };
}

/**
 * Streams each photo's RAW file straight from R2 into the zip, one at a time -
 * never buffers a whole RAW file in memory, since these can be 20-80MB each
 * and a bulk admin download could span hundreds of them.
 */
export async function appendRawFiles(
  archive: Archiver,
  photos: Photo[],
  opts: { ip: string; userAgent: string | undefined },
): Promise<BatchResult> {
  const makeName = nameFactory();
  const succeeded: string[] = [];
  const failed: string[] = [];

  for (const photo of photos) {
    const label = photo.title ?? photo.originalFilename;
    try {
      const object = await getObject(photo.rawStorageKey);
      const webStream = await object.Body!.transformToWebStream();
      const nodeStream = Readable.fromWeb(webStream as import("node:stream/web").ReadableStream<Uint8Array>);
      const ext = photo.originalFilename.includes(".")
        ? photo.originalFilename.slice(photo.originalFilename.lastIndexOf(".") + 1)
        : photo.rawFormat.toLowerCase();

      archive.append(nodeStream, {
        name: makeName(photo.title ?? photo.originalFilename.replace(/\.[^.]+$/, ""), ext),
      });

      await db.insert(schema.downloadEvents).values({
        photoId: photo.id,
        fileType: "raw",
        token: null,
        ipAddress: opts.ip,
        userAgent: opts.userAgent,
        watermarkOk: null,
        downloadedByAdmin: true,
      });
      succeeded.push(label);
    } catch {
      failed.push(label);
    }
  }

  return { succeeded, failed };
}

/** A short text entry describing any skipped photos, or null if everything succeeded. */
export function manifestEntry(result: BatchResult): string | null {
  if (result.failed.length === 0) return null;
  return [
    `Included: ${result.succeeded.length}`,
    `Skipped (could not be downloaded): ${result.failed.length}`,
    "",
    ...result.failed,
    "",
  ].join("\n");
}
