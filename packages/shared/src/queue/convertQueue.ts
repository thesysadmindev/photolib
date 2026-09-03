import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";

export const CONVERT_QUEUE_NAME = "convert-photo";

export interface ConvertPhotoJobData {
  photoId: string;
}

let queue: Queue<ConvertPhotoJobData> | undefined;

export function getConvertQueue(): Queue<ConvertPhotoJobData> {
  if (!queue) {
    queue = new Queue<ConvertPhotoJobData>(CONVERT_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return queue;
}

export async function enqueueConvertPhoto(photoId: string): Promise<void> {
  const q = getConvertQueue();
  await q.add(
    "convert",
    { photoId },
    { jobId: photoId },
  );
}
