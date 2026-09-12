"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Pagination } from "@/components/Pagination";

interface AdminPhoto {
  id: string;
  title: string | null;
  originalFilename: string;
  status: "pending" | "processing" | "ready" | "failed";
  errorMessage: string | null;
  isPublic: boolean;
  uploadedAt: string;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 250, 500];

export default function AdminPhotosPage() {
  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState<"raw" | "jpg" | "avif" | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/photos?page=${page}&pageSize=${pageSize}`);
    const data = await res.json();
    setPhotos(data.photos);
    setTotalPages(data.totalPages);
    setTotalCount(data.totalCount);
    setLoading(false);
  }, [page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  // Selection is scoped to the current page - reset it whenever the page or page size changes.
  useEffect(() => {
    setSelected(new Set());
    setBulkError(null);
  }, [page, pageSize]);

  function changePageSize(value: string) {
    setPageSize(value === "all" ? "all" : Number(value));
    setPage(1);
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
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    load();
  }

  async function bulkDownload(fileType: "raw" | "jpg" | "avif") {
    if (selected.size === 0 || bulkDownloading) return;
    setBulkDownloading(fileType);
    setBulkError(null);
    try {
      const res = await fetch("/api/admin/photos/download/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: Array.from(selected), fileType }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `photolib-${fileType}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBulkDownloading(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Manage photos</h1>
          <p>{loading ? "Loading…" : `${totalCount} photo${totalCount === 1 ? "" : "s"}`}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label htmlFor="page-size" style={{ fontSize: 13, color: "var(--muted)" }}>
            Per page
          </label>
          <select id="page-size" value={pageSize} onChange={(e) => changePageSize(e.target.value)}>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {!loading && photos.length === 0 && (
        <div className="empty-state">Nothing uploaded yet — head to Upload to add your first photo.</div>
      )}

      {photos.length > 0 && (
        <>
          <div className="selection-bar">
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={selected.size === photos.length}
                onChange={toggleSelectAll}
                style={{ width: "auto" }}
              />
              Select all on page
            </label>
            <span className="selection-count">{selected.size} selected</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={selected.size === 0 || bulkDownloading !== null}
              onClick={() => bulkDownload("raw")}
            >
              {bulkDownloading === "raw" ? "Zipping…" : "Download RAW (zip)"}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={selected.size === 0 || bulkDownloading !== null}
              onClick={() => bulkDownload("jpg")}
            >
              {bulkDownloading === "jpg" ? "Zipping…" : "Download JPG (zip)"}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={selected.size === 0 || bulkDownloading !== null}
              onClick={() => bulkDownload("avif")}
            >
              {bulkDownloading === "avif" ? "Zipping…" : "Download AVIF (zip)"}
            </button>
            {bulkError && <span className="error-note">{bulkError}</span>}
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
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
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(photo.id)}
                        onChange={() => toggleSelected(photo.id)}
                        style={{ width: "auto" }}
                      />
                    </td>
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

          <Pagination page={page} totalPages={totalPages} onNavigate={setPage} disabled={loading} />
        </>
      )}
    </div>
  );
}
