/**
 * Simple in-process semaphore to cap concurrent calls to the watermark
 * sidecar from this Node process, so a burst of simultaneous downloads
 * queues briefly in Node rather than overwhelming the single-threaded
 * Python embed process.
 */
class Semaphore {
  private available: number;
  private queue: Array<() => void> = [];

  constructor(concurrency: number) {
    this.available = concurrency;
  }

  async acquire(): Promise<() => void> {
    if (this.available > 0) {
      this.available -= 1;
      return () => this.release();
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.available -= 1;
    return () => this.release();
  }

  private release() {
    this.available += 1;
    const next = this.queue.shift();
    if (next) next();
  }
}

export const watermarkEmbedLimiter = new Semaphore(4);
