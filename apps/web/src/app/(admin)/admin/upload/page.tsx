"use client";

import { useState, useRef } from "react";

type StatusKind = "success" | "error" | null;

export default function AdminUploadPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<{ kind: StatusKind; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!file) {
      setStatus({ kind: "error", message: "Choose a RAW file first." });
      return;
    }

    setUploading(true);
    setStatus(null);

    const formData = new FormData();
    formData.append("file", file);
    if (title) formData.append("title", title);
    if (description) formData.append("description", description);

    const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
    const data = await res.json();

    setUploading(false);

    if (res.status === 201) {
      setStatus({ kind: "success", message: `Uploaded — processing started (photo ${data.photoId}).` });
      setTitle("");
      setDescription("");
      if (fileInput.current) fileInput.current.value = "";
    } else if (res.status === 409) {
      setStatus({
        kind: "error",
        message: `Duplicate: this RAW file was already uploaded (photo ${data.photoId}).`,
      });
    } else {
      setStatus({ kind: "error", message: `Error: ${data.error ?? "upload failed"}` });
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Upload a RAW photo</h1>
          <p>Converts to JPG and extracts EXIF automatically in the background.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-card">
        <div className="field">
          <label htmlFor="file">RAW file</label>
          <input
            id="file"
            ref={fileInput}
            type="file"
            accept=".cr2,.cr3,.nef,.arw,.dng,.raf,.orf,.rw2,.pef,.srw"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            type="text"
            placeholder="Optional"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
          />
        </div>
        <button className="btn btn-block" type="submit" disabled={uploading}>
          {uploading ? "Uploading…" : "Upload"}
        </button>
        {status && <div className={`form-message ${status.kind}`}>{status.message}</div>}
      </form>
    </div>
  );
}
