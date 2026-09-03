"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AdminAlbum {
  id: string;
  name: string;
}

export default function EditPhotoPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [allAlbums, setAllAlbums] = useState<AdminAlbum[]>([]);
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    async function load() {
      const [photoRes, albumsRes] = await Promise.all([
        fetch(`/api/admin/photos/${params.id}`),
        fetch("/api/admin/albums"),
      ]);
      const photoData = await photoRes.json();
      const albumsData = await albumsRes.json();

      setTitle(photoData.photo.title ?? "");
      setDescription(photoData.photo.description ?? "");
      setTagsInput((photoData.tags as string[]).join(", "));
      setSelectedAlbumIds(new Set(photoData.albumIds as string[]));
      setAllAlbums(albumsData.albums.map((a: AdminAlbum) => ({ id: a.id, name: a.name })));
      setLoading(false);
    }
    load();
  }, [params.id]);

  function toggleAlbum(id: string) {
    setSelectedAlbumIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const res = await fetch(`/api/admin/photos/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        tags,
        albumIds: Array.from(selectedAlbumIds),
      }),
    });

    setSaving(false);

    if (res.ok) {
      setStatus({ kind: "success", message: "Saved." });
      router.refresh();
    } else {
      const data = await res.json();
      setStatus({ kind: "error", message: data.error ?? "Failed to save" });
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Edit photo</h1>
          <p>Title, description, tags, and album membership.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-card" style={{ maxWidth: 560 }}>
        <div className="field">
          <label htmlFor="title">Title</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <div className="field">
          <label htmlFor="tags">Tags</label>
          <input
            id="tags"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="landscape, sunset, portugal"
          />
          <div className="field-hint">Comma-separated. New tags are created automatically.</div>
        </div>
        <div className="field">
          <label>Albums</label>
          {allAlbums.length === 0 ? (
            <div className="field-hint">No albums yet — create one on the Albums page.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {allAlbums.map((album) => (
                <label key={album.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={selectedAlbumIds.has(album.id)}
                    onChange={() => toggleAlbum(album.id)}
                    style={{ width: "auto" }}
                  />
                  {album.name}
                </label>
              ))}
            </div>
          )}
        </div>
        <button className="btn btn-block" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        {status && <div className={`form-message ${status.kind}`}>{status.message}</div>}
      </form>
    </div>
  );
}
