import React from "react";

export default function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
}) {
  const pageNumbers = [];

  // Only show a limited range of pages
  const startPage = Math.max(0, currentPage - 2);
  const endPage = Math.min(totalPages - 1, currentPage + 2);

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 8,
        marginTop: 16,
        alignItems: "center",
      }}
    >
      <button
        className="btn btn-secondary btn-sm"
        disabled={currentPage === 0}
        onClick={() => onPageChange(currentPage - 1)}
      >
        ← Prev
      </button>

      {startPage > 0 && <span>...</span>}

      {pageNumbers.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`btn btn-sm ${
            p === currentPage ? "btn-primary" : "btn-secondary"
          }`}
          style={{ minWidth: "36px" }}
        >
          {p + 1}
        </button>
      ))}

      {endPage < totalPages - 1 && <span>...</span>}

      <button
        className="btn btn-secondary btn-sm"
        disabled={currentPage === totalPages - 1}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next →
      </button>
    </div>
  );
}
