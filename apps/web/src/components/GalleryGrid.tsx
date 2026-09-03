"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface PhotoListItem {
  id: string;
  title: string | null;
  takenAt: string | null;
  cameraMake: string | null;
  cameraModel: string | null;
  thumbUrl: string;
}

interface PhotosResponse {
  photos: PhotoListItem[];
  nextCursor: string | null;
}

function formatMeta(photo: PhotoListItem): string | null {
  const parts = [photo.cameraModel, photo.takenAt ? new Date(photo.takenAt).toLocaleDateString() : null].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

interface GalleryGridProps {
  /** Endpoint to page through; must return { photos, nextCursor } like /api/photos does. */
  baseUrl?: string;
  emptyMessage?: string;
}

export function GalleryGrid({ baseUrl = "/api/photos", emptyMessage = "No photos have been published yet." }: GalleryGridProps) {
  const [photos, setPhotos] = useState<PhotoListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const loadMore = useCallback(async () => {
    setLoading(true);
    const separator = baseUrl.includes("?") ? "&" : "?";
    const url = cursor ? `${baseUrl}${separator}cursor=${encodeURIComponent(cursor)}` : baseUrl;
    const res = await fetch(url);
    const data: PhotosResponse = await res.json();
    setPhotos((prev) => [...prev, ...data.photos]);
    setCursor(data.nextCursor);
    setHasMore(Boolean(data.nextCursor));
    setLoading(false);
    setInitialLoad(false);
  }, [cursor, baseUrl]);

  useEffect(() => {
    setPhotos([]);
    setCursor(null);
    setInitialLoad(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  useEffect(() => {
    if (initialLoad) loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoad]);

  if (!initialLoad && photos.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div>
      <div className="gallery-grid">
        {photos.map((photo) => {
          const meta = formatMeta(photo);
          return (
            <Link key={photo.id} href={`/photo/${photo.id}`} className="gallery-card">
              <div className="gallery-card-image">
                <img src={photo.thumbUrl} alt={photo.title ?? "Untitled photo"} loading="lazy" />
              </div>
              <div className="gallery-card-caption">
                <div className="gallery-card-title">{photo.title ?? "Untitled"}</div>
                {meta && <div className="gallery-card-meta">{meta}</div>}
              </div>
            </Link>
          );
        })}
      </div>
      {hasMore && (
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <button className="btn btn-secondary" onClick={loadMore} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
