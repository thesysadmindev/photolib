const WATERMARK_SVC_URL = process.env.WATERMARK_SVC_URL ?? "http://127.0.0.1:8000";
const EMBED_TIMEOUT_MS = 20_000;
const EXTRACT_TIMEOUT_MS = 20_000;

export class WatermarkServiceError extends Error {}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function embedWatermark(
  jpgBytes: Buffer,
  token: string,
): Promise<Buffer> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${WATERMARK_SVC_URL}/embed`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Watermark-Token": token,
        },
        body: new Uint8Array(jpgBytes),
      },
      EMBED_TIMEOUT_MS,
    );
  } catch (err) {
    throw new WatermarkServiceError(`embed request failed: ${(err as Error).message}`);
  }

  if (!res.ok) {
    throw new WatermarkServiceError(`embed failed with status ${res.status}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

export interface ExtractResult {
  token: string | null;
  confidence: number | null;
}

export async function extractWatermark(jpgBytes: Buffer): Promise<ExtractResult> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${WATERMARK_SVC_URL}/extract`,
      {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: new Uint8Array(jpgBytes),
      },
      EXTRACT_TIMEOUT_MS,
    );
  } catch (err) {
    throw new WatermarkServiceError(`extract request failed: ${(err as Error).message}`);
  }

  if (!res.ok) {
    throw new WatermarkServiceError(`extract failed with status ${res.status}`);
  }

  return res.json();
}
