"use client";

type PageToken = number | "ellipsis";

function getPageNumbers(current: number, total: number): PageToken[] {
  const pages: PageToken[] = [1];

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push("ellipsis");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push("ellipsis");

  if (total > 1) pages.push(total);

  return pages;
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onNavigate: (page: number) => void;
  disabled?: boolean;
}

export function Pagination({ page, totalPages, onNavigate, disabled }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onNavigate(page - 1)}
        disabled={disabled || page <= 1}
      >
        ← Prev
      </button>

      {getPageNumbers(page, totalPages).map((p, i) =>
        p === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="pagination-ellipsis">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className={`btn btn-sm pagination-page ${p === page ? "" : "btn-secondary"}`}
            onClick={() => p !== page && onNavigate(p)}
            disabled={disabled}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onNavigate(page + 1)}
        disabled={disabled || page >= totalPages}
      >
        Next →
      </button>
    </nav>
  );
}
