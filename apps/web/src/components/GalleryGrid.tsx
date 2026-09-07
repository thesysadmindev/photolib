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

  if (!loading && photos.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div>
      <div className={`gallery-grid ${loading ? "gallery-grid-loading" : ""}`}>
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

      <Pagination page={page} totalPages={totalPages} onNavigate={goToPage} disabled={loading} />
    </div>
  );
}
