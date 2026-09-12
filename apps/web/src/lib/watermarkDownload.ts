import { db, schema } from "@photolib/shared";
import type { FileType } from "@photolib/shared";
import { embedWatermark } from "./watermarkClient";
import { generateWatermarkToken } from "./token";
import { jpegToAvif } from "./imageTranscode";

export type Photo = typeof schema.photos.$inferSelect;
export type DownloadFormat = "jpg" | "avif";

const MAX_TOKEN_ATTEMPTS = 3;

/**
 * Embeds a fresh watermark token into a photo's JPEG master and, for AVIF
 * downloads, transcodes the result to AVIF. The watermark is always embedded
 * in the JPEG domain - TrustMark's only empirically-validated robustness
 * envelope (see services/watermark-svc/wm/constants.py) - so an AVIF download
 * is a transcode of that watermarked JPEG, never a separate embed into the
 * stored AVIF master.
 */
export async function embedWatermarkedDownload(
  baseJpg: Buffer,
  token: string,
  format: DownloadFormat,
): Promise<Buffer> {
  const watermarked = await embedWatermark(baseJpg, token);
  return format === "avif" ? jpegToAvif(watermarked) : watermarked;
}

export interface RecordDownloadParams {
  photoId: string;
  fileType: FileType;
  ip: string;
  userAgent: string | undefined;
  downloadedByAdmin: boolean;
  produce: (token: string) => Promise<Buffer>;
}

/**
 * Generates a token, produces the watermarked file, and logs a download_events
 * row - retrying with a fresh token on the (astronomically unlikely) unique
 * constraint clash. Throws if produce() fails or every attempt collides.
 */
export async function recordDownloadWithRetry(
  params: RecordDownloadParams,
): Promise<{ buffer: Buffer; token: string }> {
  let attempt = 0;
  for (;;) {
    attempt += 1;
    const token = generateWatermarkToken();
    const buffer = await params.produce(token);
    try {
      await db.insert(schema.downloadEvents).values({
        photoId: params.photoId,
        fileType: params.fileType,
        token,
        ipAddress: params.ip,
        userAgent: params.userAgent,
        watermarkOk: true,
        downloadedByAdmin: params.downloadedByAdmin,
      });
      return { buffer, token };
    } catch (insertErr) {
      const isUniqueViolation = (insertErr as { code?: string }).code === "23505";
      if (!isUniqueViolation || attempt >= MAX_TOKEN_ATTEMPTS) throw insertErr;
    }
  }
}
