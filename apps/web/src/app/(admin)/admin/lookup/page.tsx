"use client";

import { useRef, useState } from "react";

interface LookupResult {
  match: boolean;
  reason?: string;
  confidence?: number | null;
  extractedToken?: string;
  photo?: { id: string; title: string | null; originalFilename: string };
  ipAddress?: string;
  downloadedAtUtc?: string;
  userAgent?: string | null;
}

export default function AdminLookupPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/admin/lookup", { method: "POST", body: formData });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Lookup failed");
      return;
    }

    setResult(data);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Watermark lookup</h1>
          <p>Upload a suspicious/leaked JPG to trace it back to a download event.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-card">
        <div className="field">
          <label htmlFor="lookup-file">JPG file</label>
          <input id="lookup-file" ref={fileInput} type="file" accept="image/jpeg" required />
        </div>
        <button className="btn btn-block" type="submit" disabled={loading}>
          {loading ? "Analyzing…" : "Analyze"}
        </button>
        {error && <div className="form-message error">{error}</div>}
      </form>

      {result && (
        <div className="result-card">
          {result.match ? (
            <table className="exif-table">
              <tbody>
                <tr>
                  <td>Photo</td>
                  <td>{result.photo?.title ?? result.photo?.originalFilename}</td>
                </tr>
                <tr>
                  <td>Downloader IP</td>
                  <td>{result.ipAddress}</td>
                </tr>
                <tr>
                  <td>Downloaded at (UTC)</td>
                  <td>{result.downloadedAtUtc}</td>
                </tr>
                <tr>
                  <td>User agent</td>
                  <td>{result.userAgent ?? "—"}</td>
                </tr>
                {result.confidence != null && (
                  <tr>
                    <td>Confidence</td>
                    <td>{result.confidence}</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <p style={{ margin: 0 }}>No match: {result.reason}</p>
          )}
        </div>
      )}
    </div>
  );
}
