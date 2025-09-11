// src/components/common/PhoneList.jsx
import React from "react";

export default function PhoneList({ phone, phone_number, phone_numbers }) {
  const list = Array.isArray(phone_numbers)
    ? phone_numbers
    : String(phone ?? phone_number ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  if (!list.length) return <>-</>;
  return (
    <div className="phone-multi">
      {list.map((p, i) => (
        <div key={i}>{p}</div>
      ))}
    </div>
  );
}
