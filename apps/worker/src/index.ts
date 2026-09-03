import "./env.js"; // must be first: loads root .env before @photolib/shared reads process.env

import fs from "node:fs";
import path from "node:path";
import { Worker } from "bullmq";
import { getRedisConnection, CONVERT_QUEUE_NAME } from "@photolib/shared";
import type { ConvertPhotoJobData } from "@photolib/shared";
import { config } from "./config.js";
import { processConvertPhoto } from "./processors/convertPhoto.js";

const worker = new Worker<ConvertPhotoJobData>(
  CONVERT_QUEUE_NAME,
  async (job) => {
    console.log(`[convert-photo] starting job ${job.id} (photo ${job.data.photoId})`);
    await processConvertPhoto(job.data);
    console.log(`[convert-photo] finished job ${job.id}`);
  },
  {
    connection: getRedisConnection(),
    concurrency: 2, // darktable-cli is CPU-heavy; keep this low relative to available cores
  },
);

worker.on("failed", (job, err) => {
  console.error(`[convert-photo] job ${job?.id} failed: ${err.message}`);
});

// Sweep orphaned scratch directories left behind by a crashed worker process
// (normal completion always cleans up in convertPhoto's `finally`).
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const ORPHAN_MAX_AGE_MS = 6 * 60 * 60 * 1000;

async function sweepScratchDir() {
  try {
    const entries = await fs.promises.readdir(config.scratchDir, { withFileTypes: true });
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(config.scratchDir, entry.name);
      const stat = await fs.promises.stat(fullPath);
      if (now - stat.mtimeMs > ORPHAN_MAX_AGE_MS) {
        await fs.promises.rm(fullPath, { recursive: true, force: true });
        console.log(`[sweep] removed orphaned scratch dir ${fullPath}`);
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`[sweep] failed: ${(err as Error).message}`);
    }
  }
}

fs.promises.mkdir(config.scratchDir, { recursive: true }).then(() => {
  setInterval(sweepScratchDir, SWEEP_INTERVAL_MS);
});

console.log("Worker started, listening for convert-photo jobs.");

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
