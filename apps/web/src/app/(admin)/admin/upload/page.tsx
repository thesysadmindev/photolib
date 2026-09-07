"use client";

import { useEffect, useRef, useState } from "react";

type ItemStatus = "pending" | "uploading" | "success" | "duplicate" | "error";

interface AdminAlbum {
  id: string;
  name: string;
}

interface UploadItem {
  id: number;
  file: File;
  status: ItemStatus;
  message?: string;
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  pending: "Pending",
  uploading: "Uploading…",
  success: "Uploaded",
  duplicate: "Duplicate",
  error: "Failed",
};

const STATUS_CLASS: Record<ItemStatus, string> = {
  pending: "status-pending",
  uploading: "status-processing",
  success: "status-ready",
  duplicate: "status-pending",
  error: "status-failed",
};

export default function AdminUploadPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef<UploadItem[]>(items);
  itemsRef.current = items;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [allAlbums, setAllAlbums] = useState<AdminAlbum[]>([]);
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/admin/albums")
      .then((res) => res.json())
      .then((data) => setAllAlbums(data.albums.map((a: AdminAlbum) => ({ id: a.id, name: a.name }))))
      .catch(() => undefined);
  }, []);

  function toggleAlbum(id: string) {
    setSelectedAlbumIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const newItems: UploadItem[] = Array.from(fileList).map((file) => ({
      id: nextId.current++,
      file,
      status: "pending",
    }));
    setItems((prev) => [...prev, ...newItems]);
    if (fileInput.current) fileInput.current.value = "";
  }

  function removeItem(id: number) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function clearFinished() {
    setItems((prev) => prev.filter((item) => item.status === "pending" || item.status === "uploading"));
  }

  async function uploadOne(item: UploadItem): Promise<void> {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "uploading", message: undefined } : i)));

    const formData = new FormData();
    formData.append("file", item.file);
    // A single shared title/description only makes sense when uploading one file at a time.
    if (itemsRef.current.length === 1) {
      if (title) formData.append("title", title);
      if (description) formData.append("description", description);
    }
    // Album selection applies to the whole batch - a common upload is "one shoot, one album".
    for (const albumId of selectedAlbumIds) {
      formData.append("albumIds", albumId);
    }

    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (res.status === 201) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "success" } : i)));
      } else if (res.status === 409) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: "duplicate", message: `Already uploaded (photo ${data.photoId}).` }
              : i,
          ),
        );
      } else {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "error", message: data.error ?? "Upload failed" } : i)),
        );
      }
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "error", message: "Network error" } : i)),
      );
    }
  }

  async function handleUploadAll() {
    setUploading(true);
    // Sequential, not parallel: keeps behavior predictable and avoids piling up multiple
    // large RAW uploads (each up to MAX_UPLOAD_SIZE_MB) at once. Re-reads itemsRef each
    // iteration (rather than looping over a snapshot) so removing a queued file mid-batch
    // actually skips it.
    for (;;) {
      const next = itemsRef.current.find((i) => i.status === "pending");
      if (!next) break;
      await uploadOne(next);
    }
    setUploading(false);
    if (itemsRef.current.length === 1) {
      setTitle("");
      setDescription("");
    }
  }

  const pendingCount = items.filter((i) => i.status === "pending").length;
  const doneCount = items.filter((i) => i.status === "success" || i.status === "duplicate" || i.status === "error").length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Upload RAW photos</h1>
          <p>Converts to JPG and extracts EXIF automatically in the background.</p>
        </div>
      </div>

      <div className="form-card" style={{ maxWidth: 560 }}>
        <div className="field">
          <label htmlFor="file">RAW files</label>
          <input
            id="file"
            ref={fileInput}
            type="file"
            accept=".cr2,.cr3,.nef,.arw,.dng,.raf,.orf,.rw2,.pef,.srw"
            multiple
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <div className="field-hint">Select or drag multiple files to queue them all at once.</div>
        </div>

        {allAlbums.length > 0 && (
          <div className="field">
            <label>Add to albums</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {allAlbums.map((album) => (
                <label key={album.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={selectedAlbumIds.has(album.id)}
                    onChange={() => toggleAlbum(album.id)}
                    disabled={uploading}
                    style={{ width: "auto" }}
                  />
                  {album.name}
                </label>
              ))}
            </div>
            <div className="field-hint">Applies to every file in this batch.</div>
          </div>
        )}

        {items.length === 1 && (
          <>
            <div className="field">
              <label htmlFor="title">Title</label>
              <input
                id="title"
                type="text"
                placeholder="Optional"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
              />
            </div>
            <div className="field">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                placeholder="Optional"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={uploading}
              />
            </div>
          </>
        )}

        {items.length > 0 && (
          <div className="upload-list">
            {items.map((item) => (
              <div key={item.id} className="upload-list-item">
                <div className="upload-list-name">{item.file.name}</div>
                <div className="upload-list-status">
                  <span className={`status-badge ${STATUS_CLASS[item.status]}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                  {item.message && <div className="error-note">{item.message}</div>}
                </div>
                {item.status === "pending" && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => removeItem(item.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="btn-row" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn"
            onClick={handleUploadAll}
            disabled={uploading || pendingCount === 0}
          >
            {uploading ? "Uploading…" : `Upload ${pendingCount || ""} file${pendingCount === 1 ? "" : "s"}`.trim()}
          </button>
          {doneCount > 0 && !uploading && (
            <button type="button" className="btn btn-secondary" onClick={clearFinished}>
              Clear finished
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
