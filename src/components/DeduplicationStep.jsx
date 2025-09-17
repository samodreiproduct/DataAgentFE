// =======================================
// File: src/components/DeduplicationStep.jsx
// =======================================
import React, { useEffect, useMemo, useState, useCallback } from "react";
import StepSection from "./StepSection";
import PhoneList from "../reusableComponents/PhoneList";
import FaxList from "../reusableComponents/FaxList";
import { useLeadFlow } from "../context/LeadFlowContext";
const API_BASE = import.meta.env.VITE_API_BASE;

export default function DeduplicationStep({ prevStep, nextStep, sessionId }) {
  const { flowData } = useLeadFlow();
  const sessionData = flowData[sessionId] || {};
  const precomputedStats = sessionData.dedupStats;
  const sourceType = sessionData.sourceType;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  // optimistic state
  const [localActions, setLocalActions] = useState({}); // key -> "KEEP" | "DISCARD"
  const [pending, setPending] = useState({}); // key -> boolean

  // ------------ helpers (same address formatting as DataSourceStep) ------------
  const rowKey = (r, idx) => {
    const id = r.personpi ?? r.company_id ?? r.id ?? idx;
    const npiKey = String(r.npi || "").trim();
    // company key fallback: use normalized name + address (join) so keys are deterministic
    const companyKey = (
      String(r.name || "").trim() +
      "||" +
      String(r.address || "").trim()
    ).trim();
    return `${npiKey || companyKey}::${id}`;
  };
  const preferredOrder = [
    "npi",
    "name",
    "email",
    "phone_number",
    "fax",
    "specialty",
    "mailing_address",
    "primary_address",
    "secondary_address",
  ];

  const safeJson = (v) => {
    if (v == null) return null;
    if (typeof v === "string") {
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    }
    return v;
  };

  const formatAddress = (addr) => {
    if (!addr) return "-";
    if (Array.isArray(addr)) {
      const parts = addr.map((a) => formatAddress(a)).filter(Boolean);
      const s = parts.join(" | ").trim();
      return s.length ? s : "-";
    }
    if (typeof addr === "string") return addr.trim() || "-";
    const parts = [
      addr.address_1,
      addr.address_2,
      [addr.city, addr.state].filter(Boolean).join(", "),
      addr.postal_code,
    ].filter(Boolean);
    return parts.length ? parts.join(" • ") : "-";
  };

  const getName = (r) => {
    const fn = (r.first_name || "").trim();
    const ln = (r.last_name || "").trim();
    if (fn || ln) return [fn, ln].filter(Boolean).join(" ");
    const efn = (r.enriched_first_name || "").trim();
    const eln = (r.enriched_last_name || "").trim();
    if (efn || eln) return [efn, eln].filter(Boolean).join(" ");
    return "-";
  };

  const getMailing = (r) => formatAddress(safeJson(r.mailing_address));
  const getPrimary = (r) => formatAddress(safeJson(r.primary_address));
  const getSecondary = (r) => formatAddress(safeJson(r.secondary_address));

  // ------------ fetch once per session ------------
  const fetchDedup = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const nature = sessionData.dataNature || "person"; // ← decide person or company
      const res = await fetch(
        `${API_BASE}/deduplicate?data_nature=${nature}&session_id=${encodeURIComponent(
          sessionId
        )}`
      );

      const data = await res.json();
      if (data?.status === "success") {
        const all = Array.isArray(data.all_records) ? data.all_records : [];
        setRows(all);
      } else {
        setRows([]);
      }
    } catch (e) {
      console.error("Error fetching deduplication:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, sessionData.dataNature]);

  useEffect(() => {
    fetchDedup();
  }, [fetchDedup]);

  // ------------ duplicate metadata (by NPI) ------------
  const { duplicateSet, firstIndexByNPI } = useMemo(() => {
    const counts = new Map();
    const firstIdx = new Map();
    rows.forEach((r, idx) => {
      const npiKey = String(r.npi || "").trim();
      const companyKey = (
        String(r.name || "").trim() +
        "||" +
        String(r.address || "").trim()
      ).trim();
      const key = npiKey || companyKey;
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
      if (!firstIdx.has(key)) firstIdx.set(key, idx);
    });
    const dups = new Set();
    counts.forEach((c, k) => {
      if (c > 1) dups.add(k);
    });
    return { duplicateSet: dups, firstIndexByNPI: firstIdx };
  }, [rows]);

  const isLaterDuplicate = (r, idx) => {
    const key = String(r.npi || "").trim();
    if (!key || !duplicateSet.has(key)) return false;
    const firstIdx = firstIndexByNPI.get(key);
    return typeof firstIdx === "number" && idx !== firstIdx;
    // first occurrence stays white; later duplicates are potential yellow/keep/discard
  };

  // effective action = local override (optimistic) or server value
  const effectiveAction = (r, idx) => {
    const key = rowKey(r, idx);
    const local = localActions[key];
    if (local) return local;
    return (r.dedup_action || "").toUpperCase();
  };

  // ------------ stats ------------
  const stats = useMemo(() => {
    if (precomputedStats) {
      return precomputedStats; // ✅ use upload stats directly
    }

    // fallback: scraping mode (calculate from rows)
    const total = rows.length;
    const uniqueNpis = new Set();
    rows.forEach((r) => {
      const k = String(r.npi || "").trim();
      if (k) uniqueNpis.add(k);
    });
    const unique_rows = uniqueNpis.size;

    let actions_taken = 0;
    let unresolved = 0;
    rows.forEach((r, idx) => {
      if (!isLaterDuplicate(r, idx)) return;
      const act = effectiveAction(r, idx);
      if (act) actions_taken += 1;
      else unresolved += 1;
    });

    return {
      total_rows: total,
      unique_rows,
      duplicates_found: unresolved,
      actions_taken,
    };
  }, [rows, localActions, duplicateSet, firstIndexByNPI, precomputedStats]);

  // show Action column only if at least one unresolved later-duplicate exists
  const showActionColumn = useMemo(
    () =>
      rows.some(
        (r, idx) => isLaterDuplicate(r, idx) && !effectiveAction(r, idx)
      ),
    [rows, localActions, duplicateSet, firstIndexByNPI]
  );

  // ------------ POST helpers ------------
  const postKeep = async (session_id, recordId, nature) => {
    const url = `${API_BASE}/deduplicate/keep?session_id=${encodeURIComponent(
      session_id
    )}&record_id=${encodeURIComponent(recordId)}&data_nature=${nature}`;

    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`${res.status}: ${t}`);
    }
    return res.json().catch(() => ({}));
  };

  const postDiscard = async (session_id, recordId, nature) => {
    const url = `${API_BASE}/deduplicate/discard?session_id=${encodeURIComponent(
      session_id
    )}&record_id=${encodeURIComponent(recordId)}&data_nature=${nature}`;
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`${res.status}: ${t}`);
    }
    return res.json().catch(() => ({}));
  };

  // ------------ optimistic actions ------------
  const handleAction = async (r, idx, action) => {
    const nature = sessionData.dataNature || "person";
    const recordId = nature === "person" ? r.personpi : r.company_id;
    if (!recordId || !sessionId) return;
    const key = rowKey(r, idx);
    // Optimistic update
    setLocalActions((prev) => ({ ...prev, [key]: action }));
    setPending((p) => ({ ...p, [key]: true }));

    try {
      if (action === "KEEP") {
        await postKeep(sessionId, recordId, nature);
      } else {
        await postDiscard(sessionId, recordId, nature);
      }

      // success keeps optimistic state; buttons hide automatically
    } catch (err) {
      console.error(`Failed to ${action.toLowerCase()} duplicate:`, err);
      // revert on failure
      setLocalActions((prev) => {
        const cp = { ...prev };
        delete cp[key];
        return cp;
      });
      alert(`Failed to ${action.toLowerCase()}. Check backend logs.`);
    } finally {
      setPending((p) => ({ ...p, [key]: false }));
    }
  };

  const handleKeep = (r, idx) => handleAction(r, idx, "KEEP");
  const handleDiscard = (r, idx) => handleAction(r, idx, "DISCARD");

  // ------------ row style ------------
  const rowStyle = (r, idx) => {
    const act = effectiveAction(r, idx);
    if (act === "KEEP") return { backgroundColor: "#d1fae5" }; // green like dedup keep
    if (act === "DISCARD") return { backgroundColor: "#fee2e2" }; // red like dedup discard
    if (isLaterDuplicate(r, idx)) return { backgroundColor: "#fffbec" }; // pale yellow
    return {};
  };

  if (!sessionId) {
    return (
      <StepSection>
        <p style={{ textAlign: "center", margin: "2rem", fontSize: "1.2rem" }}>
          Please start a session to see deduplication data.
        </p>
      </StepSection>
    );
  }

  return (
    <StepSection>
      <div id="deduplication">
        <div className="step-header">
          <h1 className="step-title">🔍 Lead Deduplication & Validation</h1>
          <p className="step-description">
            Review and resolve duplicate leads in your session
          </p>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">{stats.total_rows}</div>
            <div className="stat-label">Total Leads</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.duplicates_found}</div>
            <div className="stat-label">Duplicates Found</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.unique_rows}</div>
            <div className="stat-label">Unique Leads</div>
          </div>
          {sourceType !== "upload" && (
            <div className="stat-card">
              <div className="stat-number">{stats.actions_taken}</div>
              <div className="stat-label">Actions Taken</div>
            </div>
          )}
        </div>

        <h3
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            margin: "2rem 0 1rem",
            color: "#1f2937",
          }}
        >
          Duplicate Conflicts Requiring Review
        </h3>

        {/* Same table look-and-feel as DataSourceStep */}
        <div className="scrape-results" style={{ marginTop: "1.5rem" }}>
          <table className="data-table">
            <thead>
              <tr>
                {sourceType === "upload" && sessionData.columns ? (
                  <>
                    {preferredOrder.map((col) => {
                      if (col === "name") return <th key="name">Name</th>;
                      if (col === "phone_number")
                        return <th key="phone_number">Phone Number</th>;
                      if (col === "fax") return <th key="fax">Fax</th>;
                      if (col === "mailing_address")
                        return <th key="mailing_address">Mailing Address</th>;
                      if (col === "primary_address")
                        return <th key="primary_address">Primary Address</th>;
                      if (col === "secondary_address")
                        return (
                          <th key="secondary_address">Secondary Address</th>
                        );
                      if (sessionData.columns.includes(col)) {
                        return (
                          <th key={col}>
                            {col
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (c) => c.toUpperCase())}
                          </th>
                        );
                      }
                      return null;
                    })}

                    {/* Extra unmapped columns */}
                    {sessionData.columns
                      .filter(
                        (col) =>
                          !preferredOrder.includes(col) &&
                          col !== "first_name" &&
                          col !== "last_name" &&
                          col !== "phone_number" &&
                          col !== "fax"
                      )
                      .map((col) => (
                        <th key={col}>
                          {col
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                        </th>
                      ))}
                  </>
                ) : (sessionData.dataNature || "person") === "person" ? (
                  <>
                    <th>NPI</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Fax</th>
                    <th>Specialty</th>
                    <th>Mailing Address</th>
                    <th>Primary Address</th>
                    <th>Secondary Address</th>
                    {showActionColumn && <th>Action</th>}
                  </>
                ) : (
                  <>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th>Website</th>
                    <th>LinkedIn</th>
                    {showActionColumn && <th>Action</th>}
                  </>
                )}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={
                      sourceType === "upload"
                        ? sessionData.columns?.length || 1
                        : showActionColumn
                        ? 10
                        : 9
                    }
                    style={{ textAlign: "center" }}
                  >
                    Loading deduplication data… ⏳
                  </td>
                </tr>
              ) : rows.length ? (
                sourceType === "upload" && sessionData.columns ? (
                  rows.map((row, i) => (
                    <tr key={i}>
                      {preferredOrder.map((col) => {
                        if (col === "name") {
                          return (
                            <td key="name">
                              {[row.first_name, row.last_name]
                                .filter(Boolean)
                                .join(" ") ||
                                row.name ||
                                "-"}
                            </td>
                          );
                        }
                        if (col === "phone_number") {
                          return (
                            <td key="phone_number">
                              <PhoneList
                                phone={row.phone}
                                phone_number={row.phone_number}
                                phone_numbers={row.phone_numbers}
                              />
                            </td>
                          );
                        }
                        if (col === "fax") {
                          return (
                            <td key="fax">
                              <FaxList
                                fax={row.fax}
                                fax_numbers={row.fax_numbers}
                              />
                            </td>
                          );
                        }
                        if (col === "mailing_address")
                          return (
                            <td key="mailing_address">{getMailing(row)}</td>
                          );
                        if (col === "primary_address")
                          return (
                            <td key="primary_address">{getPrimary(row)}</td>
                          );
                        if (col === "secondary_address")
                          return (
                            <td key="secondary_address">{getSecondary(row)}</td>
                          );

                        if (sessionData.columns.includes(col)) {
                          return <td key={col}>{row[col] || "-"}</td>;
                        }
                        return null;
                      })}

                      {/* Extra unmapped columns */}
                      {sessionData.columns
                        .filter(
                          (col) =>
                            !preferredOrder.includes(col) &&
                            col !== "first_name" &&
                            col !== "last_name" &&
                            col !== "phone_number" &&
                            col !== "fax"
                        )
                        .map((col) => (
                          <td key={col}>{row[col] || "-"}</td>
                        ))}
                    </tr>
                  ))
                ) : (
                  rows.map((r, idx) => {
                    const key = rowKey(r, idx);
                    const dupLater = isLaterDuplicate(r, idx);
                    const act = effectiveAction(r, idx);
                    const isPending = !!pending[key];
                    const nature = sessionData.dataNature || "person";

                    return (
                      <tr key={key} style={rowStyle(r, idx)}>
                        {nature === "person" ? (
                          <>
                            <td>{r.npi || "-"}</td>
                            <td>{getName(r)}</td>
                            <td>{r.email || "-"}</td>
                            <td className="phone">
                              <PhoneList
                                phone={r.phone}
                                phone_number={r.phone_number}
                                phone_numbers={r.phone_numbers}
                              />
                            </td>
                            <td className="fax">
                              <FaxList
                                fax={r.fax}
                                fax_numbers={r.fax_numbers}
                              />
                            </td>
                            <td>{r.specialty || "-"}</td>
                            <td>{getMailing(r)}</td>
                            <td>{getPrimary(r)}</td>
                            <td>{getSecondary(r)}</td>
                          </>
                        ) : (
                          <>
                            <td>{r.name || "-"}</td>
                            <td>{r.email || "-"}</td>
                            <td className="phone">
                              <PhoneList phone={r.phone} />
                            </td>
                            <td>{r.address || "-"}</td>
                            <td>{r.website || "-"}</td>
                            <td>{r.linkedin_url || "-"}</td>
                          </>
                        )}
                        {showActionColumn && (
                          <td>
                            {dupLater && !act ? (
                              <>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleKeep(r, idx)}
                                  disabled={isPending}
                                >
                                  {isPending ? "Keeping…" : "Keep"}
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  style={{ marginLeft: "0.5rem" }}
                                  onClick={() => handleDiscard(r, idx)}
                                  disabled={isPending}
                                >
                                  {isPending ? "Discarding…" : "Discard"}
                                </button>
                              </>
                            ) : null}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )
              ) : (
                <tr>
                  <td
                    colSpan={
                      sourceType === "upload"
                        ? sessionData.columns?.length || 1
                        : showActionColumn
                        ? 10
                        : 9
                    }
                    style={{ textAlign: "center" }}
                  >
                    No records found 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="button-group">
          <button className="btn btn-secondary btn-large" onClick={prevStep}>
            ← Previous Step
          </button>
          <button className="btn btn-primary btn-large" onClick={nextStep}>
            Continue to Enrichment <span>→</span>
          </button>
        </div>
      </div>
    </StepSection>
  );
}
