"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "@/components/Pagination";

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
  page: number;
  totalPages: number;
}

function formatMeta(photo: PhotoListItem): string | null {
  const parts = [photo.cameraModel, photo.takenAt ? new Date(photo.takenAt).toLocaleDateString() : null].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

interface GalleryGridProps {
  /** Endpoint to page through; must return { photos, page, totalPages } like /api/photos does. */
  baseUrl?: string;
  emptyMessage?: string;
}

export function GalleryGrid({ baseUrl = "/api/photos", emptyMessage = "No photos have been published yet." }: GalleryGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pageParam = Number(searchParams.get("page"));
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1;

  const [photos, setPhotos] = useState<PhotoListItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const separator = baseUrl.includes("?") ? "&" : "?";
    fetch(`${baseUrl}${separator}page=${page}`)
      .then((res) => res.json())
      .then((data: PhotosResponse) => {
        if (cancelled) return;
        setPhotos(data.photos);
        setTotalPages(data.totalPages);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [baseUrl, page]);

  // Selection is scoped to the current page's results - reset it whenever the
  // page or filter changes so stale ids from a previous page can't linger.
  useEffect(() => {
    setSelecting(false);
    setSelected(new Set());
    setDownloadError(null);
  }, [baseUrl, page]);

  function goToPage(target: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(target));
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === photos.length ? new Set() : new Set(photos.map((p) => p.id))));
  }

  async function downloadSelected() {
    if (selected.size === 0 || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch("/api/photos/download/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: Array.from(selected) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "photos.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  if (!loading && photos.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div>
      {photos.length > 0 && (
        <div className="selection-bar">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSelecting((v) => !v);
              setSelected(new Set());
            }}
          >
            {selecting ? "Cancel" : "Select photos"}
          </button>
          {selecting && (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={toggleSelectAll}>
                {selected.size === photos.length ? "Deselect all" : "Select all"}
              </button>
              <span className="selection-count">{selected.size} selected</span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={downloadSelected}
                disabled={selected.size === 0 || downloading}
              >
                {downloading ? "Preparing zip…" : `Download${selected.size ? ` (${selected.size})` : ""}`}
              </button>
            </>
          )}
          {downloadError && <span className="error-note">{downloadError}</span>}
        </div>
      )}

      <div className={`gallery-grid gallery-grid-photos ${loading ? "gallery-grid-loading" : ""}`}>
        {photos.map((photo) => {
          const meta = formatMeta(photo);
          const isSelected = selected.has(photo.id);
          return (
            // The checkbox is a sibling of the Link, not nested inside it: a nested
            // interactive control would need either stopPropagation (which doesn't
            // stop the anchor's native navigation, only preventDefault does) or
            // preventDefault (which would also block the label's own "activate the
            // checkbox" behavior). Keeping them separate sidesteps both problems.
            <div key={photo.id} className="gallery-card-wrapper">
              {selecting && (
                <label className="gallery-card-select">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelected(photo.id)} />
                </label>
              )}
              <Link
                href={`/photo/${photo.id}`}
                className="gallery-card"
                onClick={(e) => {
                  if (selecting) {
                    e.preventDefault();
                    toggleSelected(photo.id);
                  }
                }}
              >
                <div className="gallery-card-image">
                  <img src={photo.thumbUrl} alt={photo.title ?? "Untitled photo"} loading="lazy" />
                </div>
                <div className="gallery-card-caption">
                  <div className="gallery-card-title">{photo.title ?? "Untitled"}</div>
                  {meta && <div className="gallery-card-meta">{meta}</div>}
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      <Pagination page={page} totalPages={totalPages} onNavigate={goToPage} disabled={loading} />
    </div>
  );
}
