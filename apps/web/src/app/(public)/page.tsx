import Link from "next/link";
import { GalleryGrid } from "@/components/GalleryGrid";

export default function GalleryPage({ searchParams }: { searchParams: { tag?: string } }) {
  const tag = searchParams.tag;

  return (
    <div className="container">
      <div className="page-header" style={{ marginTop: 32 }}>
        <div>
          <h1>Photo Library</h1>
          {tag ? (
            <p>
              Filtered by tag <strong>{tag}</strong> · <Link href="/">clear</Link>
            </p>
          ) : (
            <p>Browse and download photos from the collection.</p>
          )}
        </div>
      </div>
      <GalleryGrid
        baseUrl={tag ? `/api/photos?tag=${encodeURIComponent(tag)}` : "/api/photos"}
        emptyMessage={tag ? "No photos with this tag." : "No photos have been published yet."}
      />
    </div>
  );
}
