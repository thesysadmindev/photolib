export function rawKey(photoId: string, originalFilename: string): string {
  return `raw/${photoId}/${originalFilename}`;
}

export function jpgKey(photoId: string): string {
  return `jpg/${photoId}/base.jpg`;
}

export function thumbKey(photoId: string): string {
  return `jpg/${photoId}/thumb.jpg`;
}

export function avifKey(photoId: string): string {
  return `avif/${photoId}/base.avif`;
}

export function avifThumbKey(photoId: string): string {
  return `avif/${photoId}/thumb.avif`;
}
