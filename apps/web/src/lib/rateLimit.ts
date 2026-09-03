import { getRedisConnection } from "@photolib/shared";

const WINDOW_SECONDS = 60;
const MAX_REQUESTS_PER_WINDOW = 20;

/**
 * Fixed-window counter per IP, scoped by route. Good enough to blunt naive
 * scraping/abuse of the download + watermark-embed endpoints without adding
 * a second infra dependency (Redis is already required for BullMQ).
 */
export async function checkRateLimit(
  scope: string,
  ip: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const redis = getRedisConnection();
  const key = `ratelimit:${scope}:${ip}`;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }

  return {
    allowed: count <= MAX_REQUESTS_PER_WINDOW,
    remaining: Math.max(0, MAX_REQUESTS_PER_WINDOW - count),
  };
}
