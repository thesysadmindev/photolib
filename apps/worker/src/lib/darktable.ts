import { execa } from "execa";
import { config } from "../config.js";

export class DarktableError extends Error {
  constructor(
    message: string,
    public readonly stdout: string,
    public readonly stderr: string,
  ) {
    super(message);
  }
}

/**
 * Converts a RAW file to JPEG via darktable-cli. Applies darktable's default
 * auto-generated processing history (no .xmp sidecar provided) for
 * reasonable out-of-the-box color/tone rendering.
 */
export async function convertRawToJpeg(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  try {
    await execa(
      "darktable-cli",
      [
        inputPath,
        outputPath,
        "--core",
        "--conf",
        `plugins/imageio/format/jpeg/quality=${config.jpegQuality}`,
      ],
      { timeout: config.darktableTimeoutMs },
    );
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message: string };
    throw new DarktableError(
      `darktable-cli failed: ${e.message}`,
      (e.stdout ?? "").slice(0, 4000),
      (e.stderr ?? "").slice(0, 4000),
    );
  }
}
