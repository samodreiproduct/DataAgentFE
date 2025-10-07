import React, { useEffect, useState } from "react";
import { getAuthHeaders } from "../context/LeadFlowContext";
const API_BASE = import.meta.env.VITE_API_BASE;

export default function OngoingSessions({ onUseSession, onBack, authUser }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function fetchSessions() {
      setLoading(true);
      setError(null);
      try {
        const url = new URL(`${API_BASE}/enrichment/ongoing_sessions`);
        if (authUser?.user_id)
          url.searchParams.set("user_id", String(authUser.user_id));
        const res = await fetch(url.toString(), { headers: getAuthHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // backend returns { status: "ok", sessions: [...], count }
        const s = Array.isArray(data?.sessions) ? data.sessions : [];
        if (mounted) setSessions(s);
      } catch (e) {
        console.error("fetch ongoing sessions error:", e);
        if (mounted) setError("Failed to load sessions.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchSessions();
    return () => {
      mounted = false;
    };
  }, [authUser]);

  return (
    <div className="step-section active">
      <div className="step-header">
        <h1 className="step-title">🕒 Ongoing Sessions</h1>
        <p className="step-description">
          Manage and resume your current data enrichment sessions
        </p>
      </div>

      {loading ? (
        <p>Loading sessions…</p>
      ) : error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : sessions.length === 0 ? (
        <p>No ongoing sessions found.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Session ID</th>
              <th>Name</th>
              <th>Status</th>
              <th>Total Rows</th>
              <th>Created At</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.session_id}>
                <td style={{ fontFamily: "monospace" }}>{s.session_id}</td>
                <td>{s.name || "-"}</td>
                <td>{s.status}</td>
                <td>{typeof s.total_rows === "number" ? s.total_rows : "-"}</td>
                <td>
                  {s.created_at ? new Date(s.created_at).toLocaleString() : "-"}
                </td>
                <td>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onUseSession(s.session_id)}
                  >
                    Use Session →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: "1rem" }}>
        <button className="btn btn-secondary" onClick={onBack}>
          ⬅ Back
        </button>
      </div>
    </div>
  );
}
