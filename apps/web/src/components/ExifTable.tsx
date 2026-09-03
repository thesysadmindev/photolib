"use client";

import { useState } from "react";

// exiftool -json -G -n output uses "Group:Tag" keys (e.g. "EXIF:Make").
// These are the fields most people care about; shown first, in this order.
const HIGHLIGHT_FIELDS: Array<{ keys: string[]; label: string }> = [
  { keys: ["EXIF:Make", "IFD0:Make"], label: "Camera make" },
  { keys: ["EXIF:Model", "IFD0:Model"], label: "Camera model" },
  { keys: ["EXIF:LensModel", "Composite:LensID"], label: "Lens" },
  { keys: ["EXIF:DateTimeOriginal"], label: "Date taken" },
  { keys: ["EXIF:ExposureTime"], label: "Exposure time" },
  { keys: ["EXIF:FNumber"], label: "Aperture" },
  { keys: ["EXIF:ISO"], label: "ISO" },
  { keys: ["EXIF:FocalLength"], label: "Focal length" },
  { keys: ["Composite:GPSLatitude"], label: "GPS latitude" },
  { keys: ["Composite:GPSLongitude"], label: "GPS longitude" },
];

const OMIT_PREFIXES = ["SourceFile", "ExifTool:", "File:FileName", "File:Directory"];

function firstOf(exif: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (exif[key] !== undefined && exif[key] !== null && exif[key] !== "") {
      return exif[key];
    }
  }
  return undefined;
}

export function ExifTable({ exif }: { exif: Record<string, unknown> | null }) {
  const [showAll, setShowAll] = useState(false);

  if (!exif) return <p>No EXIF data available.</p>;

  const highlights = HIGHLIGHT_FIELDS.map((f) => ({
    label: f.label,
    value: firstOf(exif, f.keys),
  })).filter((f) => f.value !== undefined);

  const allEntries = Object.entries(exif)
    .filter(([key]) => !OMIT_PREFIXES.some((p) => key.startsWith(p)))
    .filter(([, value]) => value !== null && value !== "");

  return (
    <div>
      <table className="exif-table">
        <tbody>
          {highlights.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{String(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        className="btn btn-secondary btn-sm exif-toggle"
        onClick={() => setShowAll((v) => !v)}
      >
        {showAll ? "Hide full metadata" : "Show full metadata"}
      </button>
      {showAll && (
        <table className="exif-table" style={{ marginTop: 14 }}>
          <tbody>
            {allEntries.map(([key, value]) => (
              <tr key={key}>
                <td>{key}</td>
                <td>{String(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
