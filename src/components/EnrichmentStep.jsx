// =======================================
// File: src/components/EnrichmentStep.jsx
// =======================================
// It is used for Enrihcbhing data from External sources
// currently using Serp for linked-In scrapping and Contact-out for email and phone
//adding npi also for phone number scraping.
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import StepSection from "./StepSection";
import PhoneList from "../reusableComponents/PhoneList";
import FaxList from "../reusableComponents/FaxList";
import PaginationControls from "./ui/PaginationControls";
import { getAuthHeaders, getAuthUser } from "../context/LeadFlowContext";
const API_BASE = import.meta.env.VITE_API_BASE;

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
  // Remove-same-numbers button state (single-click guard + in-flight flag)
  const [removeRunning, setRemoveRunning] = useState(false);
  const [removeClicked, setRemoveClicked] = useState(false);
  // ✅ New checkboxes for optional enrichment sources
  const [useNPI, setUseNPI] = useState(false);
  const [useContactOut, setUseContactOut] = useState(false);
  const [findNPI, setFindNPI] = useState(false);

  // Polling / progress states
  const [enqueuedCount, setEnqueuedCount] = useState(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef(null);
  const pollAttemptsRef = useRef(0);
  const prevDoneRef = useRef(null);

  // Tune these as needed for large jobs
  const POLL_INTERVAL_MS = 5000;
  const POLL_MAX_ATTEMPTS = 120; // ~10 minutes safety cap; raise for larger jobs

  // frontend pagination
  const ENRICH_PAGE_SIZE_DEFAULT = 50;
  const [enrichPage, setEnrichPage] = useState(0);
  const [enrichPageSize, setEnrichPageSize] = useState(
    ENRICH_PAGE_SIZE_DEFAULT
  );
  const enrichTotalPages = Math.max(
    1,
    Math.ceil((rows?.length || 0) / enrichPageSize)
  );
  const pagedRows = (rows || []).slice(
    enrichPage * enrichPageSize,
    (enrichPage + 1) * enrichPageSize
  );

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

  // more robust: collect all digit codepoints and join them.
  // falls back to empty string when no digits present.
  const normalizeDigits = (s) => {
    if (s == null) return "";
    const str = String(s);
    // Prefer Unicode-aware digit extraction (covers full-width digits etc.)
    let m = str.match(/\p{N}/gu); // requires modern browsers (Chrome/Edge/Firefox support)
    if (!m) {
      // fallback to ASCII digits if Unicode property not available or no match
      m = str.match(/\d/g);
    }
    return m ? m.join("") : "";
  };

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

  // ---------- fetch full rows (improved: abortable + check resp.ok) ----------
  const fetchEnrichment = useCallback(
    async (opts = {}) => {
      if (!sessionId) return;
      const { signal } = opts;
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/enrichment?session_id=${encodeURIComponent(sessionId)}`,
          { signal, headers: getAuthHeaders() }
        );

        if (!res.ok) {
          // server returned non-2xx
          console.error(
            "fetchEnrichment HTTP error",
            res.status,
            res.statusText
          );
          setRows([]);
          return;
        }

        const data = await res.json().catch((e) => {
          console.error("fetchEnrichment json parse error:", e);
          return null;
        });

        if (Array.isArray(data?.rows)) {
          setRows(data.rows);
        } else if (Array.isArray(data)) {
          // defensive: some endpoints return raw array
          setRows(data);
        } else {
          setRows([]);
        }
      } catch (e) {
        if (e.name === "AbortError") {
          // fetch was cancelled — quietly ignore
        } else {
          console.error("Error fetching enrichment list:", e);
          setRows([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [sessionId]
  );

  useEffect(() => {
    fetchEnrichment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchEnrichment]);

  // reset to first page when rows or page-size change
  useEffect(() => {
    setEnrichPage(0);
  }, [rows]);
  useEffect(() => {
    setEnrichPage(0);
  }, [enrichPageSize]);

  // ---------- dynamic stats ----------
  const { leadsToEnrich, successfullyEnriched, successRate } = useMemo(() => {
    // Active = NOT discarded and NOT kept
    const active = rows.filter(
      (r) => r.dedup_action !== "DISCARD" && r.dedup_action !== "KEEP"
    );

    // “Enriched” signal: any of LinkedIn URL / scraped phone / degree / year / email
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

  // ---------- polling helpers ----------
  const stopPolling = () => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
    pollAttemptsRef.current = 0;
    prevDoneRef.current = null;
  };

  // ---------- poll progress endpoint (improved error handling + backoff stop) ----------
  const pollOnce = async () => {
    try {
      const url = `${API_BASE}/enrichment/session_progress?session_id=${encodeURIComponent(
        sessionId
      )}`;
      const resp = await fetch(url, { headers: getAuthHeaders() });

      if (!resp.ok) {
        // non-2xx — count as a failed poll attempt and maybe stop
        console.error(
          "Progress endpoint returned",
          resp.status,
          resp.statusText
        );
        pollAttemptsRef.current += 1;
        if (pollAttemptsRef.current >= POLL_MAX_ATTEMPTS) {
          stopPolling();
          try {
            if (window && window.showToast)
              window.showToast(
                "Enrichment polling stopped (progress endpoint error).",
                "error"
              );
          } catch {}
          return;
        }
        // schedule next attempt (simple backoff)
        pollRef.current = setTimeout(pollOnce, POLL_INTERVAL_MS);
        return;
      }

      const p = (await resp.json()) || {};
      const total = Number(p.total || 0);
      const done = Number(p.done || 0);
      const runningCount = Number(p.running || 0);

      setEnqueuedCount(total);

      if (prevDoneRef.current === null || done !== prevDoneRef.current) {
        // fetch rows only when done changed (or first poll)
        // use AbortController to avoid race conditions
        const ac = new AbortController();
        await fetchEnrichment({ signal: ac.signal });
        prevDoneRef.current = done;
      }

      pollAttemptsRef.current += 1;

      // stop conditions
      if (
        (total > 0 && done >= total) ||
        pollAttemptsRef.current >= POLL_MAX_ATTEMPTS ||
        total === 0
      ) {
        stopPolling();

        if (total > 0 && done >= total) {
          try {
            if (window && window.showToast)
              window.showToast("Enrichment completed.", "success");
          } catch {}
        } else if (total === 0) {
          try {
            if (window && window.showToast)
              window.showToast("No jobs were enqueued for enrichment.", "info");
          } catch {}
        } else {
          try {
            if (window && window.showToast)
              window.showToast(
                "Enrichment polling stopped (timeout).",
                "warning"
              );
          } catch {}
        }
        return;
      }

      // continue polling
      pollRef.current = setTimeout(pollOnce, POLL_INTERVAL_MS);
    } catch (e) {
      console.error("Polling error:", e);
      pollAttemptsRef.current += 1;
      if (pollAttemptsRef.current >= POLL_MAX_ATTEMPTS) {
        stopPolling();
        try {
          if (window && window.showToast)
            window.showToast("Enrichment polling stopped (error).", "error");
        } catch {}
        return;
      }
      // retry
      pollRef.current = setTimeout(pollOnce, POLL_INTERVAL_MS);
    }
  };

  // ---------- start enrichment (improved: robust value parsing + defensive polling start) ----------
  const runEnrichment = async () => {
    if (!sessionId) return;
    setRunning(true);
    setLastRun(null);
    setEnqueuedCount(null);
    try {
      const authUser = getAuthUser();
      const url = new URL(`${API_BASE}/enrichment/start`);
      url.searchParams.set("session_id", sessionId);
      if (authUser && authUser.email) {
        url.searchParams.set("name", `Run by ${authUser.email}`);
      }
      if (authUser && authUser.user_id) {
        url.searchParams.set("user_id", String(authUser.user_id));
      }
      // add query params for NPI and ContactOut flags
      url.searchParams.set("use_npi", useNPI ? 1 : 0);
      url.searchParams.set("use_contactout", useContactOut ? 1 : 0);
      url.searchParams.set("find_npi", findNPI ? 1 : 0);

      const res = await fetch(url.toString(), {
        method: "POST",
        headers: getAuthHeaders(), // no need for Content-Type or body
      });

      const data = await res.json().catch(() => ({}));
      setLastRun(data || {});
      setHasRun(true); // mark that user clicked "Start Enrichment"

      const enq = Number(
        data?.enqueued != null
          ? data.enqueued
          : data?.total != null
          ? data.total
          : 0
      );
      setEnqueuedCount(enq);

      // refresh UI immediately (use AbortController to avoid overlapping fetches)
      const ac = new AbortController();
      await fetchEnrichment({ signal: ac.signal });

      // start polling only if there are enqueued jobs
      if (enq > 0) {
        setPolling(true);
        pollAttemptsRef.current = 0;
        prevDoneRef.current = null;
        // small delay then first poll
        pollRef.current = setTimeout(pollOnce, POLL_INTERVAL_MS);
      } else {
        try {
          if (window && window.showToast)
            window.showToast(
              "No active rows to enqueue for enrichment.",
              "info"
            );
        } catch {}
      }
    } catch (e) {
      console.error("Enrichment start failed:", e);
      setLastRun({ status: "error" });
      try {
        if (window && window.showToast)
          window.showToast("Failed to start enrichment.", "error");
      } catch {}
    } finally {
      setRunning(false);
    }
  };

  // Remove same phone numbers (call commit_review). Single-click only.
  const removeSameNumbers = async (opts = {}) => {
    if (!sessionId) return;
    if (removeClicked) return; // already done once (single-click guard)
    setRemoveRunning(true);

    try {
      // Option A: only commit for visible page (safer for large sessions)
      // Build personpi list from current page rows
      const personpis = pagedRows
        .map((r) => r.personpi)
        .filter((p) => p != null);

      const url = new URL(`${API_BASE}/enrichment/commit_review`);
      url.searchParams.set("session_id", sessionId);

      // If you prefer whole-session commit, omit personpis and don't set query param
      if (personpis.length) {
        // append multiple personpis
        personpis.forEach((pi) =>
          url.searchParams.append("personpis", String(pi))
        );
      }

      const res = await fetch(url.toString(), {
        method: "POST",
        headers: getAuthHeaders(),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("commit_review failed", res.status, data);
        try {
          if (window && window.showToast)
            window.showToast("Failed to remove same numbers.", "error");
        } catch {}
        return;
      }

      // success: mark as clicked so button can't be clicked again
      setRemoveClicked(true);
      try {
        if (window && window.showToast)
          window.showToast(
            `Removed ${data.updated || 0} duplicate numbers.`,
            "success"
          );
      } catch {}

      // Refresh table to reflect removed numbers
      await fetchEnrichment();
    } catch (e) {
      console.error("removeSameNumbers error:", e);
      try {
        if (window && window.showToast)
          window.showToast("Error while removing same numbers.", "error");
      } catch {}
    } finally {
      setRemoveRunning(false);
    }
  };

  // cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        {/* Enrichment Options */}
        <div
          className="form-group"
          style={{
            marginBottom: "1rem",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <label
            className="form-label"
            style={{ fontWeight: 600, marginBottom: "4px" }}
          >
            Enrichment Options
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              opacity: findNPI ? 0.5 : 1, // grey out visually
              pointerEvents: findNPI ? "none" : "auto", // prevent clicks when Find NPI active
            }}
          >
            <input
              type="checkbox"
              checked={useNPI}
              onChange={(e) => setUseNPI(e.target.checked)}
              disabled={findNPI} // disable when Find NPI selected
            />
            <span>
              Use NPI{" "}
              <small style={{ color: "#6b7280" }}>(only works for US)</small>
            </span>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              opacity: findNPI ? 0.5 : 1, // grey out visually
              pointerEvents: findNPI ? "none" : "auto", // prevent clicks
            }}
          >
            <input
              type="checkbox"
              checked={useContactOut}
              onChange={(e) => setUseContactOut(e.target.checked)}
              disabled={findNPI} // disable when Find NPI selected
            />
            <span>Use ContactOut</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <input
              type="checkbox"
              checked={findNPI}
              onChange={(e) => {
                const checked = e.target.checked;
                setFindNPI(checked);
                if (checked) {
                  // auto-uncheck the others for clarity
                  setUseNPI(false);
                  setUseContactOut(false);
                }
              }}
            />
            <span>
              Find NPI{" "}
              <small style={{ color: "#6b7280" }}>
                (detect NPI using Name, City, State, Specialty)
              </small>
            </span>
          </label>
        </div>

        {/* Run enrichment */}
        <div
          className="button-group"
          style={{
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <button
            className="btn btn-primary"
            onClick={runEnrichment}
            disabled={running || polling} // disable during request or while poller running
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            {running && (
              <span
                className="spinner"
                style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid #fff",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "spin 1s linear infinite",
                }}
              />
            )}
            {running ? "Enriching…" : "Start Enrichment"}
          </button>

          {/* Remove same phone numbers button — always visible now */}
          <button
            className="btn btn-warning"
            onClick={removeSameNumbers}
            disabled={removeRunning || removeClicked || polling || running}
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
            title={
              removeClicked
                ? "Already removed duplicate numbers"
                : "Remove enriched numbers that match uploaded numbers"
            }
          >
            {removeRunning
              ? "Removing…"
              : removeClicked
              ? "Removed"
              : "Remove same phone numbers"}
          </button>

          {/* Status / progress */}
          {lastRun && (
            <span
              style={{
                marginLeft: 12,
                color: "#6b7280",
                display: "inline-block",
              }}
            >
              {lastRun.status === "ok" ? (
                lastRun.enqueued != null ? (
                  <>
                    <div>
                      Enqueued <strong>{lastRun.enqueued}</strong> jobs —
                      pollers will process them.
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <div
                        style={{
                          height: 8,
                          width: 250,
                          background: "#e5e7eb",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${
                              leadsToEnrich
                                ? Math.round(
                                    (successfullyEnriched /
                                      Math.max(1, leadsToEnrich)) *
                                      100
                                  )
                                : 0
                            }%`,
                            background: "#10b981",
                            transition: "width 400ms ease",
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 12, marginTop: 6 }}>
                        {successfullyEnriched} / {leadsToEnrich} enriched
                        {polling ? " • processing…" : ""}
                      </div>
                    </div>
                  </>
                ) : (
                  `Processed ${lastRun.processed || 0}, updated ${
                    lastRun.updated || 0
                  }${lastRun.serp_key_present ? "" : " • SERP key missing"}${
                    lastRun.openai_key_present ? "" : " • OpenAI key missing"
                  }`
                )
              ) : lastRun?.status === "error" ? (
                "Last run failed."
              ) : (
                ""
              )}
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
                pagedRows.map((r, i) => {
                  const idx = enrichPage * enrichPageSize + i; // global index for helpers

                  // visual cue whether row looks enriched
                  const isEnriched =
                    (r.linkedin_url &&
                      String(r.linkedin_url)
                        .toLowerCase()
                        .includes("linkedin.com")) ||
                    (r.email && String(r.email).trim()) ||
                    (r.scraped_phone_number &&
                      String(r.scraped_phone_number).trim()) ||
                    (r.degree && String(r.degree).trim()) ||
                    (r.degree_year && String(r.degree_year).trim());

                  return (
                    <tr
                      key={`${r.npi || idx}-${r.personpi || idx}`}
                      style={{
                        background: isEnriched ? "#f8fffb" : undefined,
                      }}
                    >
                      <td>{r.npi || "-"}</td>
                      <td>{getName(r)}</td>
                      <td>
                        {(() => {
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
                              {all.map((em, j) => (
                                <a
                                  key={em + j}
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
                          phone={r.phone}
                          phone_number={r.phone_number}
                          phone_numbers={r.phone_numbers}
                        />
                      </td>
                      <td className="fax">
                        <FaxList fax={r.fax} fax_numbers={r.fax_numbers} />
                      </td>
                      <td>{r.specialty || "-"}</td>
                      <td>{getMailing(r)}</td>
                      <td>{getPrimary(r)}</td>
                      <td>{getSecondary(r)}</td>
                      <td className="phone">
                        {(() => {
                          // helper: convert JSON/string to array (keeps only non-empty strings)
                          const toArray = (val) => {
                            if (!val) return [];
                            if (Array.isArray(val))
                              return val
                                .map(String)
                                .map((s) => s.trim())
                                .filter(Boolean);
                            if (typeof val === "string") {
                              try {
                                const parsed = JSON.parse(val);
                                if (Array.isArray(parsed))
                                  return parsed
                                    .map(String)
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                              } catch {
                                // fallthrough to split
                              }
                              return val
                                .split(/[;,]/)
                                .map((s) => s.trim())
                                .filter(Boolean);
                            }
                            return [];
                          };

                          // robust digits-only string
                          const digitsOnly = (s) => {
                            if (s == null) return "";
                            const m = String(s).match(/\d/g);
                            return m ? m.join("") : "";
                          };

                          // last N digits helper (use 10 as canonical phone tail)
                          const lastN = (s, n = 10) => {
                            const d = digitsOnly(s);
                            return d.length >= n ? d.slice(-n) : d;
                          };

                          // --- Build uploaded (user-provided) numbers
                          // NOTE: intentionally exclude scraped_phone_number (which is often an enriched field)
                          const uploaded = unique([
                            ...toArray(r.phone),
                            ...toArray(r.phone_number),
                            ...toArray(r.phone_numbers),
                            // DO NOT include scraped_phone_number here — that may be enriched data
                          ]);

                          // --- Build enriched numbers (from ContactOut / NPI)
                          const coPhones = unique(toArray(r.co_phones));
                          const npiPhones = unique(toArray(r.npi_phones));
                          const enrichedList = unique([
                            ...coPhones,
                            ...npiPhones,
                          ]);

                          if (!enrichedList.length) return "-";

                          // Build set of uploaded last-10 keys for fast lookup
                          const uploadedKeys = new Set(
                            uploaded.map((u) => lastN(u)).filter(Boolean)
                          );

                          // (Optional) helpful debug output while testing — remove in production
                          // console.debug("uploadedKeys", Array.from(uploadedKeys), "enriched", enrichedList);

                          return (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              {enrichedList.map((p, j) => {
                                const key = lastN(p);
                                const dup = key && uploadedKeys.has(key);
                                return (
                                  <span
                                    key={String(p) + "-" + j}
                                    style={{
                                      color: dup ? "#dc2626" : undefined,
                                      fontWeight: dup ? 700 : 400,
                                      // keep other text styling default so it can be overridden by CSS if desired
                                    }}
                                  >
                                    {p}
                                  </span>
                                );
                              })}
                            </div>
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
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} style={{ textAlign: "center" }}>
                    No records yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* pagination for enrichment table */}
          {rows.length > enrichPageSize && (
            <div style={{ marginTop: 10 }}>
              <PaginationControls
                currentPage={enrichPage}
                totalPages={enrichTotalPages}
                onPageChange={(p) => setEnrichPage(p)}
              />
              <div style={{ marginTop: 8, textAlign: "center" }}>
                <label style={{ marginRight: 8 }}>Rows per page:</label>
                <select
                  value={enrichPageSize}
                  onChange={(e) => {
                    const v = Math.max(
                      1,
                      Number(e.target.value) || ENRICH_PAGE_SIZE_DEFAULT
                    );
                    setEnrichPageSize(v);
                    setEnrichPage(0);
                  }}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          )}
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
