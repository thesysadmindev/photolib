function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const config = {
  scratchDir: process.env.WORKER_SCRATCH_DIR ?? "/tmp/photolib",
  darktableTimeoutMs: Number(process.env.DARKTABLE_TIMEOUT_MS ?? "120000"),
  jpegQuality: 92,
  thumbWidth: 800,
  get databaseUrl() {
    return requireEnv("DATABASE_URL");
  },
};
