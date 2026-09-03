"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface AdminPhoto {
  id: string;
  title: string | null;
  originalFilename: string;
  status: "pending" | "processing" | "ready" | "failed";
  errorMessage: string | null;
  isPublic: boolean;
  uploadedAt: string;
}

export default function AdminPhotosPage() {
  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/photos");
    const data = await res.json();
    setPhotos(data.photos);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function retry(id: string) {
    await fetch(`/api/admin/photos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retry" }),
    });
    load();
  }

  async function togglePublic(id: string, isPublic: boolean) {
    await fetch(`/api/admin/photos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !isPublic }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Permanently delete this photo and its files? This cannot be undone.")) return;
    await fetch(`/api/admin/photos/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Manage photos</h1>
          <p>{loading ? "Loading…" : `${photos.length} photo${photos.length === 1 ? "" : "s"}`}</p>
        </div>
      </div>

      {!loading && photos.length === 0 && (
        <div className="empty-state">Nothing uploaded yet — head to Upload to add your first photo.</div>
      )}

      {photos.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Public</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {photos.map((photo) => (
                <tr key={photo.id}>
                  <td>{photo.title ?? photo.originalFilename}</td>
                  <td>
                    <span className={`status-badge status-${photo.status}`}>{photo.status}</span>
                    {photo.errorMessage && <div className="error-note">{photo.errorMessage}</div>}
                  </td>
                  <td>{photo.isPublic ? "Yes" : "No"}</td>
                  <td>{new Date(photo.uploadedAt).toLocaleString()}</td>
                  <td>
                    <div className="btn-row">
                      {photo.status === "failed" && (
                        <button className="btn btn-secondary btn-sm" onClick={() => retry(photo.id)}>
                          Retry
                        </button>
                      )}
                      <Link className="btn btn-secondary btn-sm" href={`/admin/photos/${photo.id}/edit`}>
                        Edit
                      </Link>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => togglePublic(photo.id, photo.isPublic)}
                      >
                        {photo.isPublic ? "Unpublish" : "Publish"}
                      </button>
                      <a className="btn btn-secondary btn-sm" href={`/api/admin/photos/${photo.id}/download/raw`}>
                        Download RAW
                      </a>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(photo.id)}>
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
    </div>
  );
}
