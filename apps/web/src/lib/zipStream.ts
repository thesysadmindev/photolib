import archiver, { type Archiver } from "archiver";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

/**
 * Starts streaming a zip response immediately and returns it; `build` appends
 * entries into `archive` (Buffers or Node Readables) as they become ready and
 * calls nothing else - finalize()/error handling is done here once it settles.
 *
 * Streaming (rather than buffering the whole zip before responding) is
 * deliberate: archiver's internal stream can stall waiting for backpressure
 * relief if a large batch is appended before anything starts reading it, so
 * the response body (and its stream consumer) has to exist while `build` runs
 * - not after. The tradeoff is that if `build` appends nothing at all, the
 * client still gets a 200 with a small valid (near-empty) zip rather than an
 * error status; callers should append a manifest/readme entry describing any
 * failures so that case is never silently indistinguishable from success.
 */
export function createZipResponse(
  build: (archive: Archiver) => Promise<void>,
  downloadFilename: string,
): NextResponse {
  const archive = archiver("zip", { zlib: { level: 6 } });

  build(archive)
    .then(() => archive.finalize())
    .catch((err) => {
      archive.destroy(err instanceof Error ? err : new Error(String(err)));
    });

  const webStream = Readable.toWeb(archive) as unknown as ReadableStream;

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${downloadFilename.replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
