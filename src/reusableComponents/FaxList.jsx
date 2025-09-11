// src/components/common/FaxList.jsx
import React from "react";

export default function FaxList({ fax, fax_number, fax_numbers }) {
  const list = Array.isArray(fax_numbers)
    ? fax_numbers
    : String(fax ?? fax_number ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  if (!list.length) return <>-</>;
  return (
    <div className="phone-multi">
      {list.map((f, i) => (
        <div key={i}>{f}</div>
      ))}
    </div>
  );
}
