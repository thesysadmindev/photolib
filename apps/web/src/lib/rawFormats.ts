export const RAW_EXTENSIONS = new Set([
  ".cr2",
  ".cr3",
  ".nef",
  ".arw",
  ".dng",
  ".raf",
  ".orf",
  ".rw2",
  ".pef",
  ".srw",
]);

export function isRawExtension(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return RAW_EXTENSIONS.has(ext);
}

export function extensionOf(filename: string): string {
  return filename.slice(filename.lastIndexOf(".")).toLowerCase();
}
