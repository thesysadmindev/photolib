import "./env.js"; // must be first: loads root .env before @photolib/shared reads process.env

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  schema,
  avifKey,
  avifThumbKey,
  getObjectToFile,
  putObjectFromPath,
} from "@photolib/shared";
import { config } from "../config.js";
import { convertRawToAvif, DarktableError } from "../lib/darktable.js";

/**
 * One-off backfill: generates the AVIF master + thumbnail for photos that were
 * converted before AVIF support existed. Always converts from the original RAW
 * (never from the existing JPEG) to avoid stacking a second lossy generation on
 * the AVIF master - same rule the live convert-photo pipeline follows.
 *
 * Run via `pnpm --filter @photolib/worker run backfill-avif`. Safe to re-run:
 * only targets rows where avif_storage_key is still null, and failures on one
 * photo don't stop the rest.
 */
async function main() {
  const photos = await db
    .select()
    .from(schema.photos)
    .where(and(eq(schema.photos.status, "ready"), isNull(schema.photos.avifStorageKey)));

  console.log(`Backfilling AVIF for ${photos.length} photo(s)...`);

  let succeeded = 0;
  let failed = 0;

  for (const photo of photos) {
    const jobScratchDir = path.join(config.scratchDir, `backfill-${photo.id}`);
    await fs.promises.mkdir(jobScratchDir, { recursive: true });

    const rawExt = path.extname(photo.originalFilename) || `.${photo.rawFormat.toLowerCase()}`;
    const rawPath = path.join(jobScratchDir, `input${rawExt}`);
    const avifPath = path.join(jobScratchDir, "output.avif");
    const avifThumbPath = path.join(jobScratchDir, "thumb.avif");

    try {
      await getObjectToFile(photo.rawStorageKey, rawPath);
      await convertRawToAvif(rawPath, avifPath);
      await sharp(avifPath)
        .resize({ width: config.thumbWidth, withoutEnlargement: true })
        .avif({ quality: config.avifThumbQuality })
        .toFile(avifThumbPath);

      const avifStorageKey = avifKey(photo.id);
      const avifThumbStorageKey = avifThumbKey(photo.id);

      await putObjectFromPath(avifStorageKey, avifPath, "image/avif");
      await putObjectFromPath(avifThumbStorageKey, avifThumbPath, "image/avif");

      await db
        .update(schema.photos)
        .set({ avifStorageKey, avifThumbStorageKey })
        .where(eq(schema.photos.id, photo.id));

      succeeded += 1;
      console.log(`[ok] ${photo.id} (${photo.originalFilename})`);
    } catch (err) {
      failed += 1;
      const message =
        err instanceof DarktableError ? `${err.message}\n${err.stderr}` : (err as Error).message;
      console.error(`[failed] ${photo.id} (${photo.originalFilename}): ${message}`);
    } finally {
      await fs.promises.rm(jobScratchDir, { recursive: true, force: true });
    }
  }

  console.log(`Done. ${succeeded} succeeded, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
