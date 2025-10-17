import React, { useEffect, useState } from "react";
import { getAuthUser, getAuthHeaders } from "../context/LeadFlowContext";
const API_BASE = import.meta.env.VITE_API_BASE;

function safeParseArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through
  }
  return String(v)
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function fmtDate(iso) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    // shorter, readable: "Oct 17, 2025 • 5:22 PM"
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// shorten long ids for display
function shortId(id) {
  if (!id) return "";
  if (id.length <= 18) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

/**
 * REVIEW PRODUCTION - Updated UI (cleaner files list + nicer header)
 */
export default function ReviewProduction({ sessionId, prevStep, nextStep }) {
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);

  // global selector moved to top (user chooses people/company first)
  const [dataNature, setDataNature] = useState("person"); // "person" or "company"

  useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, dataNature]);

  const fetchFiles = async () => {
    setFilesLoading(true);
    try {
      const url = new URL(`${API_BASE}/production/files`);
      if (sessionId) url.searchParams.set("session_id", sessionId);
      if (dataNature) url.searchParams.set("data_nature", dataNature);

      const authUser = getAuthUser();
      if (authUser?.user_id) {
        url.searchParams.set("user_id", String(authUser.user_id));
      }
      url.searchParams.set("limit", "200");

      console.debug("Fetching production files URL:", url.toString());
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch files");
      const data = await res.json();
      // sort newest first just in case
      const filesArr = (data.files || []).slice().sort((a, b) => {
        const da = new Date(a.updated_at || a.created_at || 0).getTime();
        const db = new Date(b.updated_at || b.created_at || 0).getTime();
        return db - da;
      });
      setFiles(filesArr);
    } catch (e) {
      console.error("fetchFiles error:", e);
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  };

  // Open a file (respect current dataNature)
  const openFile = async (fileId) => {
    setSelected(fileId);
    setPage(1);
    await fetchRows(fileId, 1, dataNature);
    // scroll to results (optional)
    window.setTimeout(() => {
      const el = document.querySelector("#production-rows");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const fetchRows = async (fileId, pageNum = 1, nature = dataNature) => {
    setRows([]);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      params.set("page_size", String(pageSize));
      params.set("data_nature", nature);
      const authUser = getAuthUser();
      if (authUser?.user_id) params.set("user_id", String(authUser.user_id));

      const url = `${API_BASE}/production/file/${encodeURIComponent(
        fileId
      )}?${params.toString()}`;

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch rows");
      const data = await res.json();
      setRows(data.records || []);
      setTotal(data.total || 0);
      setPage(data.page || pageNum);
    } catch (e) {
      console.error("fetchRows error:", e);
      setRows([]);
      setTotal(0);
      setPage(1);
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = (fileId) => {
    const params = new URLSearchParams();
    params.set("data_nature", dataNature);
    const authUser = getAuthUser();
    if (authUser?.user_id) params.set("user_id", String(authUser.user_id));
    const url = `${API_BASE}/production/file/${encodeURIComponent(
      fileId
    )}/download${params.toString() ? `?${params.toString()}` : ""}`;
    window.open(url, "_blank");
  };

  // Convenience for combined phone display for persons
  function personPhonesForRow(r) {
    // prefer ContactOut (co_phones), then npi_phones, then scraped_phone_number
    const co = safeParseArray(
      r.co_phones || r.co_phones === null ? r.co_phones : []
    );
    const npi = safeParseArray(
      r.npi_phones || r.npi_phones === null ? r.npi_phones : []
    );
    const scraped = safeParseArray(
      r.scraped_phone_number || r.scraped_phone_number === null
        ? r.scraped_phone_number
        : []
    );
    // combine and dedupe preserving order
    const combined = [...co, ...npi, ...scraped].filter(Boolean);
    const seen = new Set();
    return combined.filter((p) => {
      const k = p.replace(/\D+/g, "");
      if (!k) return false;
      if (seen.has(k)) return false;
      seen.add(k);
      return p;
    });
  }

  // small helper to display source pill(s)
  function renderSources(f) {
    const arr = Array.isArray(f.source_types)
      ? f.source_types
      : (f.source_types || "")
          .toString()
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
    if (!arr.length) return null;
    // show only up to 2 pills
    return arr.slice(0, 2).map((s, i) => (
      <span
        key={s + i}
        className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 mr-1"
        title={s}
      >
        {s}
      </span>
    ));
  }

  return (
    <div className="p-6">
      {/* Top header + global selector */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">
            Review Production
          </h2>
          <p className="text-sm text-slate-500">
            Browse production batches and export rows as CSV
          </p>
        </div>

        {/* Global selector (moved to top) */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600">View:</label>
          <select
            value={dataNature}
            onChange={(e) => {
              const val = e.target.value;
              setDataNature(val);
              // fetchFiles will run via useEffect; also refetch current file if selected
              if (selected) {
                openFile(selected);
              } else {
                fetchFiles();
              }
            }}
            className="input input-sm border rounded px-3 py-1 text-sm"
            aria-label="Select data nature"
          >
            <option value="person">People</option>
            <option value="company">Company</option>
          </select>

          <button
            className="btn btn-secondary"
            onClick={() => {
              if (selected) fetchRows(selected, page, dataNature);
              else fetchFiles();
            }}
            disabled={filesLoading || loading}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left: files list (cards) */}
        <aside className="w-96">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-slate-700">
                Files / Batches
              </h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={fetchFiles}
                disabled={filesLoading}
              >
                {filesLoading ? "Loading…" : "Refresh"}
              </button>
            </div>

            {filesLoading ? (
              <div className="text-sm text-slate-500">Loading files…</div>
            ) : files.length === 0 ? (
              <div className="text-sm text-slate-500">
                No production files found.
              </div>
            ) : (
              <ul className="space-y-3 max-h-[72vh] overflow-auto pr-2">
                {files.map((f) => {
                  const primarySource =
                    (f.source_types &&
                      Array.isArray(f.source_types) &&
                      f.source_types[0]) ||
                    (typeof f.source_types === "string" &&
                      f.source_types.split(",")[0]) ||
                    f.source_user_id ||
                    "";

                  const active = selected === f.file_id;
                  const displayName =
                    f.display_name && !/^[0-9a-f-]{20,}$/.test(f.display_name)
                      ? f.display_name
                      : shortId(f.file_id);

                  return (
                    <li
                      key={f.file_id}
                      onClick={() => openFile(f.file_id)}
                      className={`p-3 rounded border cursor-pointer transition-colors flex flex-col gap-2
                        ${
                          active
                            ? "border-sky-300 bg-sky-50"
                            : "border-slate-100 hover:bg-sky-50 hover:border-slate-200"
                        }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800 truncate">
                            {displayName}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            <span className="font-semibold">
                              {Number(f.total_rows || 0)}
                            </span>{" "}
                            <span className="text-slate-400">rows</span>
                            <span className="mx-2 text-slate-300">•</span>
                            <span className="text-slate-500">
                              {fmtDate(f.updated_at || f.created_at)}
                            </span>
                          </div>
                          <div className="mt-1 text-xs">
                            {renderSources(f)}
                            {primarySource ? (
                              <span className="text-xs text-slate-500 ml-1">
                                By {primarySource}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="ml-2 flex flex-col gap-2">
                          <button
                            className="btn btn-primary btn-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              openFile(f.file_id);
                            }}
                          >
                            View
                          </button>
                          <button
                            className="btn btn-secondary btn-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadCsv(f.file_id);
                            }}
                          >
                            CSV
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Right: file contents */}
        <main className="flex-1">
          <div className="bg-white rounded-lg shadow-sm p-4">
            {selected ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-slate-800">
                      {/** nicer title: display_name or shortened id */}
                      {(() => {
                        const f =
                          files.find((x) => x.file_id === selected) || {};
                        const pretty =
                          f.display_name &&
                          !/^[0-9a-f-]{20,}$/.test(f.display_name)
                            ? f.display_name
                            : `File ${shortId(selected)}`;
                        return pretty;
                      })()}
                      <span className="ml-3 inline-flex items-center bg-sky-100 text-sky-800 text-xs font-semibold px-2 py-0.5 rounded">
                        {Number(
                          (files.find((x) => x.file_id === selected) || {})
                            .total_rows ||
                            total ||
                            0
                        )}{" "}
                        rows
                      </span>
                    </h3>
                    <div className="text-sm text-slate-500">
                      Showing page {page} ({rows.length} rows on this page) —
                      total {total}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-secondary"
                      onClick={() => fetchRows(selected, page, dataNature)}
                      disabled={loading}
                    >
                      Refresh
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => downloadCsv(selected)}
                    >
                      Download CSV
                    </button>
                  </div>
                </div>

                <div id="production-rows" className="overflow-x-auto">
                  {loading ? (
                    <div className="py-8 text-center text-sm text-slate-500">
                      Loading rows…
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-500">
                      No rows for this file.
                    </div>
                  ) : (
                    <table className="data-table w-full table-auto border-collapse">
                      <thead>
                        {dataNature === "person" ? (
                          <tr className="text-left text-sm text-slate-700">
                            <th className="py-2 px-3">NPI</th>
                            <th className="py-2 px-3">Name</th>
                            <th className="py-2 px-3">Email(s)</th>
                            <th className="py-2 px-3">Phones</th>
                            <th className="py-2 px-3">Specialty</th>
                            <th className="py-2 px-3">Updated</th>
                          </tr>
                        ) : (
                          <tr className="text-left text-sm text-slate-700">
                            <th className="py-2 px-3">Company ID</th>
                            <th className="py-2 px-3">Name</th>
                            <th className="py-2 px-3">Region</th>
                            <th className="py-2 px-3">Email</th>
                            <th className="py-2 px-3">Phone</th>
                            <th className="py-2 px-3">Updated</th>
                          </tr>
                        )}
                      </thead>

                      <tbody>
                        {rows.map((r, idx) =>
                          dataNature === "person" ? (
                            <tr
                              key={r.personpi || `${r.npi || "no-npi"}-${idx}`}
                              className={
                                idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                              }
                            >
                              <td className="py-2 px-3 align-top">
                                {r.npi || "-"}
                              </td>
                              <td className="py-2 px-3 align-top">
                                {`${r.first_name || ""} ${
                                  r.last_name || ""
                                }`.trim() || "-"}
                              </td>

                              <td className="py-2 px-3 align-top whitespace-normal break-words max-w-[250px]">
                                {r.co_emails &&
                                safeParseArray(r.co_emails).length > 0
                                  ? safeParseArray(r.co_emails).join(", ")
                                  : r.email && String(r.email).trim()
                                  ? r.email
                                  : "-"}
                              </td>

                              <td className="py-2 px-3 align-top whitespace-normal break-words max-w-[220px]">
                                {(() => {
                                  const phones = personPhonesForRow(r);
                                  if (!phones || phones.length === 0)
                                    return "-";
                                  return (
                                    <div className="flex flex-wrap gap-1">
                                      {phones.map((p, i) => (
                                        <span
                                          key={p + i}
                                          className="text-xs px-2 py-1 rounded-full border bg-white"
                                          style={{
                                            borderColor: "rgba(15,23,42,0.06)",
                                          }}
                                        >
                                          {p}
                                        </span>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </td>

                              <td className="py-2 px-3 align-top">
                                {r.specialty || "-"}
                              </td>
                              <td className="py-2 px-3 align-top text-sm text-slate-500">
                                {fmtDate(r.updated_at || r.created_at)}
                              </td>
                            </tr>
                          ) : (
                            <tr
                              key={r.company_id || idx}
                              className={
                                idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                              }
                            >
                              <td className="py-2 px-3 align-top">
                                {r.company_id || "-"}
                              </td>
                              <td className="py-2 px-3 align-top">
                                {r.name || "-"}
                              </td>
                              <td className="py-2 px-3 align-top">
                                {r.region || "-"}
                              </td>
                              <td className="py-2 px-3 align-top">
                                {r.email || "-"}
                              </td>
                              <td className="py-2 px-3 align-top">
                                {r.phone || "-"}
                              </td>
                              <td className="py-2 px-3 align-top text-sm text-slate-500">
                                {fmtDate(r.updated_at || r.created_at)}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* pagination */}
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-slate-500">
                    Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        fetchRows(selected, Math.max(1, page - 1), dataNature)
                      }
                      disabled={page <= 1 || loading}
                    >
                      Prev
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        fetchRows(
                          selected,
                          Math.min(
                            Math.max(1, Math.ceil(total / pageSize)),
                            page + 1
                          ),
                          dataNature
                        )
                      }
                      disabled={page * pageSize >= total || loading}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500">
                Select a file on the left to view production rows.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
