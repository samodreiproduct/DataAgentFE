// =======================================
// File: src/components/EnrichmentStep.jsx
// =======================================
import React, { useEffect, useMemo, useState, useCallback } from "react";
import StepSection from "./StepSection";
import PhoneList from "../reusableComponents/PhoneList";
import FaxList from "../reusableComponents/FaxList";

const API_BASE = "http://localhost:8000";

export default function EnrichmentStep({
  prevStep,
  nextStep,
  sessionId,
  isNPIFlow = true, // keep provider UI locked for US Healthcare
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [hasRun, setHasRun] = useState(false); // ← gate “Successfully Enriched” until user runs

  // ---------- helpers (match DataSource/Dedup formatting) ----------
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

  const asArray = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    if (typeof v === "string") {
      try {
        const p = JSON.parse(v);
        return Array.isArray(p) ? p.filter(Boolean) : [v].filter(Boolean);
      } catch {
        // comma or semicolon separated fallback
        return v
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    return [];
  };

  const normalizeDigits = (s) => String(s || "").replace(/[^\d]/g, ""); // only digits for comparison

  const unique = (arr) => Array.from(new Set(arr.filter(Boolean)));

  const formatAddress = (addr) => {
    if (!addr) return "-";

    if (Array.isArray(addr)) {
      const parts = addr.map((a) => formatAddress(a)).filter(Boolean);
      const s = parts.join(" | ").trim();
      return s.length ? s : "-";
    }

    if (typeof addr === "string") {
      return addr.trim() || "-";
    }

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

  // ---------- fetch ----------
  const fetchEnrichment = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/enrichment?session_id=${encodeURIComponent(sessionId)}`
      );
      const data = await res.json();
      if (data?.status === "success") {
        setRows(Array.isArray(data.rows) ? data.rows : []);
      } else {
        setRows([]);
      }
    } catch (e) {
      console.error("Error fetching enrichment list:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchEnrichment();
  }, [fetchEnrichment]);

  // ---------- run enrichment ----------
  const runEnrichment = async () => {
    if (!sessionId) return;
    setRunning(true);
    setLastRun(null);
    try {
      const res = await fetch(
        `${API_BASE}/enrichment/run?session_id=${encodeURIComponent(
          sessionId
        )}&limit=20`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      setLastRun(data || {});
      setHasRun(true); // ← only after user triggers enrichment
      await fetchEnrichment(); // refresh the table with updated rows
    } catch (e) {
      console.error("Enrichment failed:", e);
      setLastRun({ status: "error" });
    } finally {
      setRunning(false);
    }
  };

  // ---------- dynamic stats ----------
  const { leadsToEnrich, successfullyEnriched, successRate } = useMemo(() => {
    // Active = NOT discarded and NOT kept
    const active = rows.filter(
      (r) => r.dedup_action !== "DISCARD" && r.dedup_action !== "KEEP"
    );

    // “Enriched” signal: any of LinkedIn URL / scraped phone / degree / year
    const enriched = active.filter((r) => {
      const hasLI =
        r.linkedin_url &&
        String(r.linkedin_url).toLowerCase().includes("linkedin.com");
      const hasEmail = r.email && String(r.email).trim();
      const hasPhone =
        r.scraped_phone_number && String(r.scraped_phone_number).trim();
      const hasDegree = r.degree && String(r.degree).trim();
      const hasYear = r.degree_year && String(r.degree_year).trim();
      return Boolean(hasLI || hasEmail || hasPhone || hasDegree || hasYear);
    });

    const totalActive = active.length;
    const successCount = hasRun ? enriched.length : 0; // ← gate until run
    const rate =
      hasRun && totalActive > 0
        ? Math.round((successCount / totalActive) * 100)
        : 0;

    return {
      leadsToEnrich: totalActive,
      successfullyEnriched: successCount,
      successRate: rate,
    };
  }, [rows, hasRun]);

  if (!sessionId) {
    return (
      <StepSection>
        <p style={{ textAlign: "center", margin: "2rem", fontSize: "1.2rem" }}>
          Please start a session to see enrichment data.
        </p>
      </StepSection>
    );
  }

  return (
    <StepSection>
      <div id="enrichment">
        <div className="step-header">
          <h1 className="step-title">🚀 Data Enrichment</h1>
          <p className="step-description">
            Enhance your leads via LinkedIn + ContactOut to add email, direct
            phone, degree & year.
          </p>
        </div>

        {/* Providers (NPI/US Healthcare: Serp + LinkedIn, both on & locked) */}
        {isNPIFlow && (
          <div className="form-group">
            <label className="form-label">Enrichment Providers</label>
            <div className="checkbox-grid">
              <div className="checkbox-item">
                <input type="checkbox" id="serp" checked disabled readOnly />
                <label htmlFor="serp">Serp (Google)</label>
              </div>
              <div className="checkbox-item">
                <input
                  type="checkbox"
                  id="linkedin"
                  checked
                  disabled
                  readOnly
                />
                <label htmlFor="linkedin">
                  ContactOut (via LinkedIn profile)
                </label>
              </div>
            </div>
          </div>
        )}

        {/* 3 dynamic boxes */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">{leadsToEnrich}</div>
            <div className="stat-label">Leads to Enrich</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{successfullyEnriched}</div>
            <div className="stat-label">Successfully Enriched</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{successRate}%</div>
            <div className="stat-label">Success Rate</div>
          </div>
        </div>

        {/* Run enrichment */}
        <div className="button-group" style={{ marginBottom: "1rem" }}>
          <button
            className="btn btn-primary"
            onClick={runEnrichment}
            disabled={running}
          >
            {running ? "Enriching…" : "Start Enrichment"}
          </button>
          {lastRun && (
            <span style={{ marginLeft: 12, color: "#6b7280" }}>
              {lastRun.status === "ok"
                ? `Processed ${lastRun.processed || 0}, updated ${
                    lastRun.updated || 0
                  }${lastRun.serp_key_present ? "" : " • SERP key missing"}${
                    lastRun.openai_key_present ? "" : " • OpenAI key missing"
                  }`
                : lastRun?.status === "error"
                ? "Last run failed."
                : ""}
            </span>
          )}
        </div>

        {/* Results table (same layout as DataSourceStep, + 3 extra cols) */}
        <h3
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            margin: "2rem 0 1rem",
            color: "#1f2937",
          }}
        >
          Enrichment Results
        </h3>

        <div className="scrape-results" style={{ marginTop: "1.5rem" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>NPI</th>
                <th>Name</th>
                <th>Email</th>
                <th style={{ minWidth: "200px" }}>Phone</th>
                <th style={{ minWidth: "200px" }}>Fax</th>
                <th>Specialty</th>
                <th>Mailing Address</th>
                <th>Primary Address</th>
                <th>Secondary Address</th>
                <th style={{ minWidth: "200px" }}>Enriched Phone</th>
                <th>Doctor Degree & Year</th>
                <th>Linked-In Profile</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: "center" }}>
                    Loading… ⏳
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((r, idx) => (
                  <tr key={`${r.npi || idx}-${r.personpi || idx}`}>
                    <td>{r.npi || "-"}</td>
                    <td>{getName(r)}</td>
                    <td>
                      {(() => {
                        // Collect from new JSON column + legacy single value
                        const co = asArray(r.co_emails);
                        const legacy = asArray(r.email);
                        const all = unique([...co, ...legacy]);
                        if (!all.length) return "-";
                        return (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                            }}
                          >
                            {all.map((em, i) => (
                              <a
                                key={em + i}
                                href={`mailto:${em}`}
                                style={{
                                  textDecoration: "none",
                                  color: "#2563eb",
                                }}
                              >
                                {em}
                              </a>
                            ))}
                          </div>
                        );
                      })()}
                    </td>

                    <td className="phone">
                      <PhoneList
                        phone={r.phone} // if your row uses `phone`
                        phone_number={r.phone_number} // if your row uses `phone_number`
                        phone_numbers={r.phone_numbers} // array if present
                      />
                    </td>
                    <td className="fax">
                      <FaxList fax={r.fax} fax_numbers={r.fax_numbers} />
                    </td>
                    <td>{r.specialty || "-"}</td>
                    <td>{getMailing(r)}</td>
                    <td>{getPrimary(r)}</td>
                    <td>{getSecondary(r)}</td>
                    {/* Use same 'phone' class to keep number on one line */}
                    <td className="phone">
                      {(() => {
                        const enriched = r.scraped_phone_number || "";
                        if (!enriched) return "-";

                        // Build a set of known phones from the "Phone" column sources
                        const phoneA = asArray(r.phone);
                        const phoneNum = asArray(r.phone_number);
                        const phoneNums = asArray(r.phone_numbers);
                        const known = unique([
                          ...phoneA,
                          ...phoneNum,
                          ...phoneNums,
                        ]);
                        const knownDigits = new Set(known.map(normalizeDigits));

                        const isDuplicate = knownDigits.has(
                          normalizeDigits(enriched)
                        );

                        return (
                          <span
                            style={{
                              color: isDuplicate ? "#dc2626" : undefined,
                              fontWeight: isDuplicate ? 700 : 400,
                            }}
                          >
                            {enriched}
                          </span>
                        );
                      })()}
                    </td>

                    <td>
                      {r.degree || r.degree_year ? (
                        <>
                          {r.degree ? <span>{r.degree}</span> : null}
                          {r.degree_year ? (
                            <span>
                              {r.degree ? " • " : ""}
                              {r.degree_year}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td>
                      {r.linkedin_url &&
                      String(r.linkedin_url)
                        .toLowerCase()
                        .includes("linkedin.com") ? (
                        <a
                          href={r.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                        >
                          Open
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12} style={{ textAlign: "center" }}>
                    No records yet.
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
            Continue to Review <span>→</span>
          </button>
        </div>
      </div>
    </StepSection>
  );
}
