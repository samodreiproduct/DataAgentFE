// src/components/ui/toaster.jsx
import React, { useEffect, useState } from "react";

let idCounter = 0;

export function Toaster() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const payload = e.detail || {};
      const id = ++idCounter;
      const ttl = payload.duration ?? 3000;
      setToasts((t) => [...t, { id, ...payload }]);
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, ttl);
    };

    window.addEventListener("samodrei-toast", handler);
    return () => window.removeEventListener("samodrei-toast", handler);
  }, []);

  if (!toasts.length) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        top: 16,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            pointerEvents: "auto",
            minWidth: 220,
            maxWidth: 360,
            background: "#111827",
            color: "white",
            padding: "12px 14px",
            borderRadius: 8,
            boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {t.title || ""}
          </div>
          {t.description ? (
            <div style={{ fontSize: 13, lineHeight: 1.2 }}>{t.description}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
