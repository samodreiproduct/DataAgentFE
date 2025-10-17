import React, { useEffect, useMemo, useState, useCallback } from "react";
import StepSection from "./StepSection";
import PhoneList from "../reusableComponents/PhoneList";
import FaxList from "../reusableComponents/FaxList";
import EmailList from "../reusableComponents/EmailList";
import { useToast } from "@/components/ui/use-toast";
import PaginationControls from "./ui/PaginationControls";
import {
  getAuthUser,
  getAuthHeaders,
  useLeadFlow,
} from "../context/LeadFlowContext";
const API_BASE = import.meta.env.VITE_API_BASE;

export default function ReviewStep({ prevStep, nextStep, sessionId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [stats, setStats] = useState({ new: 0, updated: 0, unchanged: 0 });
  const [total, setTotal] = useState(0);
  // pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  const { toast } = useToast();

  // read session data to determine person vs company flows
  const { flowData } = useLeadFlow();
  const sessionData = flowData?.[sessionId] || {};
  const dataNature = (sessionData.dataNature || "person")
    .toString()
    .toLowerCase(); // "person" or "company"

  // Approved/rejected counts
  const approvedCount = useMemo(() => {
    if (stats && typeof stats.approved === "number") return stats.approved;
    return rows.filter(
      (r) => (r.reviewStatus || "").toLowerCase() === "approved"
    ).length;
  }, [stats, rows]);

  const rejectedCount = useMemo(() => {
    if (stats && typeof stats.rejected === "number") return stats.rejected;
    return rows.filter(
      (r) => (r.reviewStatus || "").toLowerCase() === "rejected"
    ).length;
  }, [stats, rows]);

  // --------- helpers reused from EnrichmentStep ----------
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
        if (Array.isArray(p)) return p.filter(Boolean);
      } catch {
        // comma/semicolon separated fallback
        return v
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    return [];
  };

  const normalizeDigits = (s) => String(s || "").replace(/[^\d]/g, ""); // only digits for comparison

  const unique = (arr) => Array.from(new Set((arr || []).filter(Boolean)));

  // compute current visible column count (we always show select + action now)
  const colCount = useMemo(() => {
    // person has many columns, company fewer — keep header spanning correct number
    return dataNature === "company" ? 1 + 7 + 1 + 1 : 1 + 13 + 1 + 1;
  }, [dataNature]);

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
    // company fallback
    if (r.name) return r.name;
    return "-";
  };
  const getMailing = (r) => formatAddress(safeJson(r.mailing_address));
  const getPrimary = (r) => formatAddress(safeJson(r.primary_address));
  const getSecondary = (r) => formatAddress(safeJson(r.secondary_address));

  // ALWAYS return string ids to avoid numeric/string mismatch in selection
  const getId = (r) => {
    if (dataNature === "company") {
      // prefer explicit company id if present
      const id = r.company_id ?? r.companyId ?? r.id ?? null;
      if (id) return String(id);
      // fallback deterministic key: name + address
      const name = (r.name || r.company || "").trim();
      const addr = (r.address || getPrimary(r) || "").trim();
      return String(`${name}|${addr}`);
    }

    const id =
      r.personpi ??
      r.npi ??
      `${(r.first_name || r.enriched_first_name || "").trim()}|${(
        r.last_name ||
        r.enriched_last_name ||
        ""
      ).trim()}|${getPrimary(r)}`;
    return String(id);
  };

  // --------- fetch rows ----------
  const fetchRows = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("session_id", sessionId);
      // send data_nature to backend so review endpoint returns correct table
      params.set("data_nature", dataNature);

      const authUser = getAuthUser();
      if (authUser && authUser.user_id) {
        params.set("user_id", String(authUser.user_id));
      }

      params.set("page", String(currentPage));
      params.set("page_size", String(pageSize));

      const url = `${API_BASE}/review?${params.toString()}`;

      const res = await fetch(url, { headers: getAuthHeaders() });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Review fetch failed: ${res.status} ${text}`);
      }
      const data = await res.json();
      console.log("REVIEW fetch result:", data); // dev-help: remove later
      const recsRaw = Array.isArray(data?.records) ? data.records : [];

      // ensure order new -> updated -> unchanged and cap preview to 50 rows
      const priority = { new: 0, updated: 1, unchanged: 2 };
      const recsSorted = recsRaw.slice().sort((a, b) => {
        const sa = (a.reviewStatus || "").toLowerCase();
        const sb = (b.reviewStatus || "").toLowerCase();
        const pa = priority.hasOwnProperty(sa) ? priority[sa] : 99;
        const pb = priority.hasOwnProperty(sb) ? priority[sb] : 99;
        if (pa !== pb) return pa - pb;
        return 0;
      });

      // Normalize statuses to lowercase
      const normalized = recsSorted.map((r) => ({
        ...r,
        reviewStatus: (r.reviewStatus || "").toString().toLowerCase(),
      }));

      setRows(normalized);

      setStats(data?.stats || { new: 0, updated: 0, unchanged: 0 });
      setTotal(data?.total || 0);
    } catch (e) {
      console.error("review fetch error:", e);
      setRows([]);
      setStats({ new: 0, updated: 0, unchanged: 0 });
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [sessionId, dataNature, currentPage, pageSize]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);
  // clamp page if pageSize/total changes
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 1)));
    if (currentPage >= totalPages) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [total, pageSize, currentPage]);

  // slice rows into displayedRows for the current page
  const displayedRows = useMemo(() => {
    const start = currentPage * pageSize;
    const end = start + pageSize;
    return rows.slice(start, end);
  }, [rows, currentPage, pageSize]);

  const visibleIds = useMemo(() => displayedRows.map(getId), [displayedRows]);

  // only rows that are selectable (not unchanged and not rejected) — limited to displayedRows
  const selectableVisibleIds = useMemo(
    () =>
      displayedRows
        .filter(
          (r) =>
            (r.reviewStatus || "").toLowerCase() !== "unchanged" &&
            (r.reviewStatus || "").toLowerCase() !== "rejected"
        )
        .map(getId),
    [displayedRows]
  );

  const selectedSelectable = useMemo(
    () => selected.filter((id) => selectableVisibleIds.includes(id)),
    [selected, selectableVisibleIds]
  );

  const allChecked =
    selectableVisibleIds.length > 0 &&
    selectedSelectable.length === selectableVisibleIds.length;
  const someChecked =
    selectedSelectable.length > 0 &&
    selectedSelectable.length < selectableVisibleIds.length;

  const toggleOne = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // header checkbox toggles only selectable visible rows
  const toggleAllVisible = (checked) => {
    setSelected(checked ? selectableVisibleIds : []);
  };

  // --------- actions (optimistic UI) ----------
  const markRow = (id, status) =>
    setRows((prev) =>
      prev.map((r) =>
        getId(r) === id
          ? { ...r, reviewStatus: (status || "").toString().toLowerCase() }
          : r
      )
    );

  // approve one person/company -> send a JSON array with single id
  const approveOne = async (id) => {
    const row = rows.find((r) => getId(r) === id);
    if (!row) {
      toast({ title: "Cannot approve", description: "Row not found." });
      return;
    }

    // choose key based on nature
    const entityId =
      dataNature === "company"
        ? row.company_id ?? row.companyId ?? null
        : row.personpi ?? null;

    if (!entityId) {
      toast({
        title: "Cannot approve",
        description:
          dataNature === "company"
            ? "Missing company id."
            : "Missing person id.",
      });
      return;
    }

    try {
      const payload = [String(entityId)];
      console.log("approveOne payload:", payload);
      const res = await fetch(`${API_BASE}/bulk-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload), // <- ARRAY
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        toast({
          title: "Error",
          description: `Approve failed: ${res.status} ${text}`,
          variant: "destructive",
        });
        return;
      }

      const data = await res.json();
      if (data?.status === "success") {
        markRow(id, "approved");
        toast({
          title: "Approved",
          description:
            dataNature === "company"
              ? `Company approved (id=${entityId}).`
              : `Record approved (npi=${row.npi || "—"}).`,
        });
        await fetchRows();
      } else {
        toast({
          title: "Error",
          description: "Approve failed",
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error("approveOne error:", e);
      toast({
        title: "Error",
        description: "Approve failed",
        variant: "destructive",
      });
    }
  };

  const rejectOne = (id) => {
    // optimistic local change — backend will be unaffected until you call bulk endpoint
    markRow(id, "rejected");
    setSelected((prev) => prev.filter((x) => x !== id));
    toast({
      title: "Rejected",
      description: "Record marked rejected locally.",
    });
  };

  // bulk approve selected -> send JSON array of ids (personpi or company_id)
  const bulkApproveSelected = async () => {
    if (!selected.length) return;

    const idKey = dataNature === "company" ? "company_id" : "personpi";

    const ids = rows
      .filter(
        (r) =>
          selected.includes(getId(r)) &&
          r[idKey] &&
          (r.reviewStatus || "").toLowerCase() !== "rejected"
      )
      .map((r) => String(r[idKey])); // ensure strings

    console.log("bulkApproveSelected payload:", ids);

    if (!ids.length) {
      toast({
        title: "No changes to apply",
        description:
          "All selected rows are unchanged or rejected — nothing to transfer.",
      });
      setSelected((prev) =>
        prev.filter((id) => {
          const row = rows.find((r) => getId(r) === id);
          return (
            row &&
            (row.reviewStatus || "").toLowerCase() !== "unchanged" &&
            (row.reviewStatus || "").toLowerCase() !== "rejected"
          );
        })
      );
      return;
    }

    // optimistic UI
    setRows((prev) =>
      prev.map((r) =>
        ids.includes(String(r[idKey])) ? { ...r, reviewStatus: "approved" } : r
      )
    );

    try {
      const res = await fetch(`${API_BASE}/bulk-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(ids),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        toast({
          title: "Error",
          description: `Bulk approve failed: ${res.status} ${text}`,
          variant: "destructive",
        });
        await fetchRows();
        return;
      }

      const data = await res.json();
      if (data?.status === "success") {
        const typeKey = dataNature === "company" ? "Company" : "People";
        const newCount = data.records_transferred?.[`${typeKey}_new`] || 0;
        const updCount = data.records_transferred?.[`${typeKey}_updated`] || 0;
        const unchCount =
          data.records_transferred?.[`${typeKey}_unchanged`] || 0;
        toast({
          title:
            newCount + updCount === 0
              ? "No changes applied"
              : "✅ Bulk Approve Completed",
          description: `New: ${newCount}, Updated: ${updCount}, Unchanged: ${unchCount}`,
          duration: 4000,
        });
        await fetchRows();
      } else {
        toast({
          title: "⚠️ Bulk Approve",
          description: "Server returned an unexpected response.",
          variant: "destructive",
        });
        await fetchRows();
      }
    } catch (e) {
      console.error("bulkApprove error:", e);
      toast({
        title: "❌ Error",
        description: "Something went wrong during bulk approve.",
        variant: "destructive",
      });
      await fetchRows();
    } finally {
      setSelected([]);
    }
  };

  // bulk approve all -> send explicit list of ids for current preview (backend may process all in session)
  const bulkApproveAll = async () => {
    const idKey = dataNature === "company" ? "company_id" : "personpi";
    const ids = rows
      .filter(
        (r) =>
          r[idKey] &&
          (r.reviewStatus || "").toString().toLowerCase() !== "rejected"
      )
      .map((r) => String(r[idKey]));

    if (!ids.length) {
      toast({
        title: "No rows to approve",
        description: "There are no staging rows eligible for approval.",
      });
      return;
    }

    try {
      toast({
        title: "Processing...",
        description:
          "Approving all eligible staging rows. This may take a moment.",
      });

      const res = await fetch(`${API_BASE}/bulk-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(ids), // send explicit list (backend may accept empty body for all)
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        toast({
          title: "Error",
          description: `Bulk approve failed: ${res.status} ${text}`,
          variant: "destructive",
        });
        return;
      }

      const data = await res.json();
      if (data?.status === "success") {
        const typeKey = dataNature === "company" ? "Company" : "People";
        const newCount = data.records_transferred?.[`${typeKey}_new`] || 0;
        const updCount = data.records_transferred?.[`${typeKey}_updated`] || 0;
        const unchCount =
          data.records_transferred?.[`${typeKey}_unchanged`] || 0;
        toast({
          title:
            newCount + updCount === 0
              ? "No changes applied (All)"
              : "✅ Bulk Approve Completed (All)",
          description: `New: ${newCount}, Updated: ${updCount}, Unchanged: ${unchCount}`,
          duration: 4000,
        });
        await fetchRows();
      } else {
        toast({
          title: "Error",
          description: "Bulk approve failed",
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "Bulk approve failed",
        variant: "destructive",
      });
    }
  };

  if (!sessionId) {
    return (
      <StepSection>
        <p style={{ textAlign: "center", margin: "2rem", fontSize: "1.2rem" }}>
          Please start a session to see review data.
        </p>
      </StepSection>
    );
  }

  // ---------- UI ----------
  const statContainerStyle = {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 8,
  };
  const statCardStyle = {
    width: 180,
    height: 84,
    borderRadius: 8,
    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: "8px 12px",
  };
  const statNumberStyle = { color: "#10b981", fontWeight: 700, fontSize: 20 };

  return (
    <StepSection>
      <div id="review">
        <div className="step-header">
          <h1 className="step-title">✅ Lead Review & Approval</h1>
          <p className="step-description">
            Review enriched leads and approve them for campaign use
          </p>
        </div>

        <div style={statContainerStyle}>
          <div style={statCardStyle}>
            <div style={statNumberStyle}>{total}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Total Leads</div>
          </div>

          <div style={statCardStyle}>
            <div style={statNumberStyle}>{stats.new}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>New</div>
          </div>

          <div style={statCardStyle}>
            <div style={statNumberStyle}>{stats.updated}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Updated</div>
          </div>

          <div style={statCardStyle}>
            <div style={statNumberStyle}>{stats.unchanged}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Unchanged</div>
          </div>
        </div>

        <h3
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            margin: "2rem 0 1rem",
            color: "#1f2937",
          }}
        >
          Leads Pending Review
        </h3>

        <div className="table-scroll-x" style={{ overflowX: "auto" }}>
          <table
            className="data-table"
            style={{ minWidth: dataNature === "company" ? "1000px" : "1300px" }}
          >
            <thead>
              <tr>
                {/* Select (always shown) */}
                <th style={{ whiteSpace: "nowrap" }}>
                  <input
                    type="checkbox"
                    onChange={(e) => toggleAllVisible(e.target.checked)}
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el && (el.indeterminate = someChecked);
                    }}
                    aria-label="Select all"
                  />
                </th>

                {dataNature === "person" ? (
                  // >>> EXACT COLUMNS FROM EnrichmentStep.jsx <<<
                  <>
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
                    <th>Doctor Degree &amp; Year</th>
                    <th>Linked-In Profile</th>

                    {/* NEW Status column */}
                    <th>Status</th>

                    {/* Action (always shown) */}
                    <th style={{ whiteSpace: "nowrap" }}>Action</th>
                  </>
                ) : (
                  // company columns
                  <>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th>Website</th>
                    <th>LinkedIn</th>
                    <th>Status</th>
                    <th style={{ whiteSpace: "nowrap" }}>Action</th>
                  </>
                )}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colCount} style={{ textAlign: "center" }}>
                    Loading… ⏳
                  </td>
                </tr>
              ) : displayedRows.length ? (
                displayedRows.map((r) => {
                  const id = getId(r);
                  const status = (r.reviewStatus || "").toLowerCase();

                  const bg =
                    status === "approved"
                      ? "#d1fae5"
                      : status === "rejected"
                      ? "#fee2e2"
                      : status === "updated"
                      ? "#fef9c3"
                      : status === "new"
                      ? "#e0f2fe"
                      : "transparent";

                  return (
                    <tr key={String(id)} style={{ backgroundColor: bg }}>
                      {/* Select */}
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.includes(id)}
                          onChange={() => toggleOne(id)}
                          disabled={status === "rejected"}
                        />
                      </td>

                      {dataNature === "person" ? (
                        // SAME CELLS AS ENRICHMENT
                        <>
                          <td>{r.npi || "-"}</td>
                          <td>{getName(r)}</td>
                          <td>
                            <EmailList
                              email={r.email}
                              co_emails={safeJson(r.co_emails)}
                            />
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
                              // Gather uploaded numbers (user-provided)
                              const uploaded = unique([
                                ...asArray(r.phone),
                                ...asArray(r.phone_number),
                                ...asArray(r.scraped_phone_number),
                                ...asArray(r.phone_numbers),
                              ]);

                              // Get enriched numbers from ContactOut + NPI (support JSON/string)
                              const coPhones = unique(
                                asArray(safeJson(r.co_phones) || r.co_phones)
                              );
                              const npiPhones = unique(
                                asArray(safeJson(r.npi_phones) || r.npi_phones)
                              );

                              const enrichedList = unique([
                                ...coPhones,
                                ...npiPhones,
                              ]);

                              if (!enrichedList.length) return "-";

                              const uploadedDigits = new Set(
                                uploaded.map(normalizeDigits)
                              );

                              return (
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                  }}
                                >
                                  {enrichedList.map((p, j) => {
                                    const isDup = uploadedDigits.has(
                                      normalizeDigits(p)
                                    );
                                    return (
                                      <span
                                        key={String(p) + j}
                                        style={{
                                          color: isDup ? "#dc2626" : undefined,
                                          fontWeight: isDup ? 700 : 400,
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

                          {/* Status */}
                          <td
                            style={{
                              fontWeight: 600,
                              textTransform: "capitalize",
                            }}
                          >
                            {r.reviewStatus || "-"}
                          </td>

                          {/* Actions */}
                          <td style={{ whiteSpace: "nowrap" }}>
                            <button
                              className="btn btn-primary"
                              style={{
                                marginRight: "0.5rem",
                                padding: "0.4rem 0.8rem",
                              }}
                              disabled={
                                status === "approved" || status === "rejected"
                              }
                              onClick={() => approveOne(id)}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: "0.4rem 0.8rem" }}
                              onClick={() => rejectOne(id)}
                              disabled={status === "rejected"}
                            >
                              Reject
                            </button>
                          </td>
                        </>
                      ) : (
                        // company row rendering
                        <>
                          <td>{r.name || "-"}</td>
                          <td>{r.email || "-"}</td>
                          <td className="phone">
                            <PhoneList
                              phone={r.phone}
                              phone_number={r.phone_number}
                              phone_numbers={r.phone_numbers}
                            />
                          </td>
                          <td>{r.address || getPrimary(r) || "-"}</td>
                          <td>
                            {r.website ? (
                              <a
                                href={r.website}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {r.website}
                              </a>
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

                          {/* Status */}
                          <td
                            style={{
                              fontWeight: 600,
                              textTransform: "capitalize",
                            }}
                          >
                            {r.reviewStatus || "-"}
                          </td>

                          {/* Actions */}
                          <td style={{ whiteSpace: "nowrap" }}>
                            <button
                              className="btn btn-primary"
                              style={{
                                marginRight: "0.5rem",
                                padding: "0.4rem 0.8rem",
                              }}
                              disabled={
                                status === "approved" ||
                                status === "unchanged" ||
                                status === "rejected"
                              }
                              onClick={() => approveOne(id)}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: "0.4rem 0.8rem" }}
                              onClick={() => rejectOne(id)}
                              disabled={
                                status === "unchanged" || status === "rejected"
                              }
                            >
                              Reject
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={colCount} style={{ textAlign: "center" }}>
                    No records to review.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "1rem",
          }}
        >
          <div>
            Rows per page:{" "}
            <select
              value={pageSize}
              onChange={(e) => {
                setCurrentPage(0);
                setPageSize(Number(e.target.value));
              }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
            </select>
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={Math.ceil(total / pageSize)}
            onPageChange={(p) => setCurrentPage(p)}
          />
        </div>

        {/* footer showing counts and hint that more rows may be on server */}
        <p style={{ marginTop: "0.5rem", color: "#4b5563" }}>
          Showing page {currentPage + 1} of {Math.ceil(total / pageSize)} (Total{" "}
          {total} records)
        </p>

        <div className="button-group" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary btn-large" onClick={prevStep}>
            ← Previous Step
          </button>

          <button
            className="btn btn-primary btn-large"
            onClick={bulkApproveSelected}
            style={{ marginLeft: 12 }}
            disabled={selectedSelectable.length === 0}
            title={
              selectedSelectable.length === 0
                ? "Select at least one (and ensure it's not unchanged)"
                : "Bulk approve"
            }
          >
            Bulk Approve Selected
          </button>

          <button
            className="btn btn-primary btn-large"
            onClick={bulkApproveAll}
            style={{ marginLeft: 12 }}
          >
            Bulk Approve All
          </button>

          <button
            className="btn btn-primary btn-large"
            onClick={nextStep}
            style={{ marginLeft: 12 }}
          >
            Continue to Segmentation →
          </button>
        </div>
      </div>
    </StepSection>
  );
}
