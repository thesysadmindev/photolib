import { execa } from "execa";

export class ExiftoolError extends Error {}

export interface NormalizedExif {
  raw: Record<string, unknown>;
  takenAt: Date | null;
  cameraMake: string | null;
  cameraModel: string | null;
}

function parseExifDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  // exiftool date format: "2024:06:01 14:32:10" (optionally with timezone).
  const match = value.match(
    /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/,
  );
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function extractExif(inputPath: string): Promise<NormalizedExif> {
  let stdout: string;
  try {
    const result = await execa("exiftool", ["-json", "-G", "-n", inputPath]);
    stdout = result.stdout;
  } catch (err) {
    throw new ExiftoolError(`exiftool failed: ${(err as Error).message}`);
  }

  const parsed = JSON.parse(stdout) as Record<string, unknown>[];
  const raw = parsed[0] ?? {};

  const takenAt = parseExifDate(raw["EXIF:DateTimeOriginal"] ?? raw["IFD0:DateTimeOriginal"]);
  const cameraMake = (raw["EXIF:Make"] ?? raw["IFD0:Make"]) as string | undefined;
  const cameraModel = (raw["EXIF:Model"] ?? raw["IFD0:Model"]) as string | undefined;

  return {
    raw,
    takenAt,
    cameraMake: cameraMake ?? null,
    cameraModel: cameraModel ?? null,
  };
}
