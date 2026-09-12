export type PhotoStatus = "pending" | "processing" | "ready" | "failed";
export type FileType = "jpg" | "raw" | "avif";

export interface ExifSummary {
  cameraMake?: string;
  cameraModel?: string;
  lens?: string;
  exposureTime?: string;
  fNumber?: string;
  iso?: number;
  focalLength?: string;
  takenAt?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
}
