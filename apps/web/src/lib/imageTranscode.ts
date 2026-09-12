import sharp from "sharp";

const AVIF_DOWNLOAD_QUALITY = 60;

/**
 * Decodes AVIF bytes and re-encodes as a high-quality JPEG. Used to feed an
 * AVIF input (a downloaded AVIF file re-uploaded to /admin/lookup) into the
 * watermark service, which only ever operates on JPEG bytes.
 */
export async function avifToJpeg(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes).jpeg({ quality: 95 }).toBuffer();
}

/**
 * Encodes JPEG bytes as AVIF for delivery. Low `effort` trades file size for
 * the encode speed needed in a per-download-request (not precomputed) path.
 */
export async function jpegToAvif(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes).avif({ quality: AVIF_DOWNLOAD_QUALITY, effort: 4 }).toBuffer();
}
