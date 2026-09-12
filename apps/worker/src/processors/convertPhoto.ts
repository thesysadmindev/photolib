import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import {
  db,
  schema,
  jpgKey,
  thumbKey,
  avifKey,
  avifThumbKey,
  getObjectToFile,
  putObjectFromPath,
} from "@photolib/shared";
import type { ConvertPhotoJobData } from "@photolib/shared";
import { config } from "../config.js";
import { convertRawToJpeg, convertRawToAvif, DarktableError } from "../lib/darktable.js";
import { extractExif, ExiftoolError } from "../lib/exiftool.js";

async function markFailed(photoId: string, message: string) {
  await db
    .update(schema.photos)
    .set({ status: "failed", errorMessage: message.slice(0, 2000) })
    .where(eq(schema.photos.id, photoId));
}

export async function processConvertPhoto(data: ConvertPhotoJobData): Promise<void> {
  const { photoId } = data;

  const [photo] = await db
    .select()
    .from(schema.photos)
    .where(eq(schema.photos.id, photoId))
    .limit(1);

  if (!photo) {
    console.warn(`convert-photo: photo ${photoId} no longer exists, skipping`);
    return;
  }

  await db
    .update(schema.photos)
    .set({ status: "processing", errorMessage: null })
    .where(eq(schema.photos.id, photoId));

  const jobScratchDir = path.join(config.scratchDir, photoId);
  await fs.promises.mkdir(jobScratchDir, { recursive: true });

  const rawExt = path.extname(photo.originalFilename) || `.${photo.rawFormat.toLowerCase()}`;
  const rawPath = path.join(jobScratchDir, `input${rawExt}`);
  const jpgPath = path.join(jobScratchDir, "output.jpg");
  const thumbPath = path.join(jobScratchDir, "thumb.jpg");
  const avifPath = path.join(jobScratchDir, "output.avif");
  const avifThumbPath = path.join(jobScratchDir, "thumb.avif");

  try {
    await getObjectToFile(photo.rawStorageKey, rawPath);

    // Both masters are converted straight from the RAW (not from each other) to avoid
    // stacking a second lossy generation on top of the JPEG.
    await convertRawToJpeg(rawPath, jpgPath);
    await convertRawToAvif(rawPath, avifPath);

    const exif = await extractExif(rawPath);

    const image = sharp(jpgPath);
    const metadata = await image.metadata();
    await sharp(jpgPath)
      .resize({ width: config.thumbWidth, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(thumbPath);
    await sharp(avifPath)
      .resize({ width: config.thumbWidth, withoutEnlargement: true })
      .avif({ quality: config.avifThumbQuality })
      .toFile(avifThumbPath);

    const jpgStorageKey = jpgKey(photoId);
    const thumbStorageKey = thumbKey(photoId);
    const avifStorageKey = avifKey(photoId);
    const avifThumbStorageKey = avifThumbKey(photoId);

    await putObjectFromPath(jpgStorageKey, jpgPath, "image/jpeg");
    await putObjectFromPath(thumbStorageKey, thumbPath, "image/jpeg");
    await putObjectFromPath(avifStorageKey, avifPath, "image/avif");
    await putObjectFromPath(avifThumbStorageKey, avifThumbPath, "image/avif");

    await db
      .update(schema.photos)
      .set({
        jpgStorageKey,
        thumbStorageKey,
        avifStorageKey,
        avifThumbStorageKey,
        exif: exif.raw,
        takenAt: exif.takenAt,
        cameraMake: exif.cameraMake,
        cameraModel: exif.cameraModel,
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        status: "ready",
        processedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(schema.photos.id, photoId));
  } catch (err) {
    let message: string;
    if (err instanceof DarktableError) {
      message = `${err.message}\n--- stderr ---\n${err.stderr}`;
    } else if (err instanceof ExiftoolError) {
      message = err.message;
    } else {
      message = (err as Error).message ?? String(err);
    }
    await markFailed(photoId, message);
    throw err; // let BullMQ retry/backoff handle transient failures
  } finally {
    await fs.promises.rm(jobScratchDir, { recursive: true, force: true });
  }
}
