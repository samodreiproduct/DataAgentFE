// EmailList.jsx
import React from "react";

export default function EmailList({ email, co_emails }) {
  // co_emails may be an array or a JSON string (safeJson will be applied by caller)
  const list = Array.isArray(co_emails)
    ? co_emails
    : co_emails
    ? [co_emails]
    : [];

  // Deduplicate and keep primary (email) first if present and not duplicated
  const normalized = [];
  if (email) normalized.push(email);
  list.forEach((e) => {
    if (!e) return;
    if (!normalized.includes(e)) normalized.push(e);
  });

  if (!normalized.length) return <span>-</span>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {normalized.map((e, i) => (
        <a
          key={String(i)}
          href={`mailto:${String(e).trim()}`}
          target="_blank"
          rel="noreferrer"
          style={{
            textDecoration: "none",
            color: "#0366d6",
            fontSize: "0.95rem",
          }}
        >
          {e}
        </a>
      ))}
    </div>
  );
}
