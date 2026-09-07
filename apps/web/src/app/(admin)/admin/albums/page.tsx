"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface AdminAlbum {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  photoCount: number;
}

export default function AdminAlbumsPage() {
  const [albums, setAlbums] = useState<AdminAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/albums");
    const data = await res.json();
    setAlbums(data.albums);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setError(null);

    const res = await fetch("/api/admin/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });

    setCreating(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create album");
      return;
    }

    setName("");
    setDescription("");
    load();
  }

  async function togglePublic(id: string, isPublic: boolean) {
    await fetch(`/api/admin/albums/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !isPublic }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this album? Photos stay untouched, only the album grouping is removed.")) return;
    await fetch(`/api/admin/albums/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Albums</h1>
          <p>Group photos into collections visitors can browse.</p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="form-card" style={{ marginBottom: 32 }}>
        <div className="field">
          <label htmlFor="album-name">Name</label>
          <input id="album-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="album-description">Description</label>
          <textarea
            id="album-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
        <button className="btn" type="submit" disabled={creating}>
          {creating ? "Creating…" : "Create album"}
        </button>
        {error && <div className="form-message error">{error}</div>}
      </form>

      {!loading && albums.length === 0 && <div className="empty-state">No albums yet.</div>}

      {albums.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Photos</th>
                <th>Public</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {albums.map((album) => (
                <tr key={album.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{album.name}</div>
                    {album.description && (
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{album.description}</div>
                    )}
                  </td>
                  <td>{album.photoCount}</td>
                  <td>{album.isPublic ? "Yes" : "No"}</td>
                  <td>
                    <div className="btn-row">
                      {album.isPublic && (
                        <Link className="btn btn-secondary btn-sm" href={`/albums/${album.slug}`}>
                          View
                        </Link>
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => togglePublic(album.id, album.isPublic)}
                      >
                        {album.isPublic ? "Unpublish" : "Publish"}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(album.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: 20, fontSize: 13 }}>
        Add photos to an album from each photo&apos;s <Link href="/admin/photos">edit page</Link>.
      </p>
    </div>
  );
}
