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
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function ReviewProduction({ sessionId, prevStep, nextStep }) {
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [dataNature, setDataNature] = useState("person"); // "person" or "company"

  useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const fetchFiles = async () => {
    setFilesLoading(true);
    try {
      const url = new URL(`${API_BASE}/production/files`);
      if (sessionId) url.searchParams.set("session_id", sessionId);

      const authUser = getAuthUser();
      if (authUser?.user_id) {
        url.searchParams.set("user_id", String(authUser.user_id));
      }
      url.searchParams.set("limit", "200");

      console.debug("Fetching production files URL:", url.toString());
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch files");
      const data = await res.json();
      setFiles(data.files || []);
    } catch (e) {
      console.error("fetchFiles error:", e);
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  };

  const openFile = async (fileId, nature = dataNature) => {
    setSelected(fileId);
    setPage(1);
    await fetchRows(fileId, 1, nature);
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

      console.debug("Fetching rows URL:", url);
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">
            Review Production
          </h2>
          <p className="text-sm text-slate-500">
            Browse production batches and export rows as CSV
          </p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left: files list */}
        <aside className="w-80">
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
                Refresh
              </button>
            </div>

            {filesLoading ? (
              <div className="text-sm text-slate-500">Loading files…</div>
            ) : files.length === 0 ? (
              <div className="text-sm text-slate-500">
                No production files found.
              </div>
            ) : (
              <ul className="space-y-3">
                {files.map((f) => {
                  let sources = [];
                  if (Array.isArray(f.source_types)) sources = f.source_types;
                  else if (typeof f.source_types === "string")
                    sources = f.source_types
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);

                  const primarySource = sources.length
                    ? sources[0]
                    : f.source_user_id || "";

                  return (
                    <li
                      key={f.file_id}
                      onClick={() => openFile(f.file_id)}
                      className={`p-3 rounded border cursor-pointer hover:bg-sky-50 ${
                        selected === f.file_id
                          ? "border-sky-300 bg-sky-50"
                          : "border-slate-100 hover:border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">
                            {f.display_name || f.file_id}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {f.total_rows ?? 0} rows •{" "}
                            {fmtDate(f.updated_at || f.created_at || "-")}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {primarySource ? `Source: ${primarySource}` : ""}
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
                      File:{" "}
                      <span className="font-normal text-slate-600">
                        {selected}
                      </span>
                    </h3>
                    <div className="text-sm text-slate-500">
                      Showing page {page} ({rows.length} rows on this page) —
                      total {total}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={dataNature}
                      onChange={(e) => {
                        setDataNature(e.target.value);
                        if (selected) fetchRows(selected, 1, e.target.value);
                      }}
                      className="input input-sm border rounded px-2 py-1 text-sm"
                    >
                      <option value="person">People</option>
                      <option value="company">Company</option>
                    </select>
                    <button
                      className="btn btn-secondary"
                      onClick={() => fetchRows(selected, page, dataNature)}
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

                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="py-8 text-center text-sm text-slate-500">
                      Loading rows…
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-500">
                      No rows for this file.
                    </div>
                  ) : (
                    <table className="data-table w-full">
                      <thead>
                        {dataNature === "person" ? (
                          <tr>
                            <th className="text-left">NPI</th>
                            <th className="text-left">Name</th>
                            <th className="text-left">Email(s)</th>
                            <th className="text-left">Phones</th>
                            <th className="text-left">Specialty</th>
                            <th className="text-left">Updated</th>
                          </tr>
                        ) : (
                          <tr>
                            <th className="text-left">Company ID</th>
                            <th className="text-left">Name</th>
                            <th className="text-left">Region</th>
                            <th className="text-left">Email</th>
                            <th className="text-left">Phone</th>
                            <th className="text-left">Updated</th>
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {rows.map((r) =>
                          dataNature === "person" ? (
                            <tr key={r.personpi || `${r.npi}-${Math.random()}`}>
                              <td>{r.npi || "-"}</td>
                              <td>
                                {`${r.first_name || ""} ${
                                  r.last_name || ""
                                }`.trim() || "-"}
                              </td>
                              <td className="whitespace-normal break-words">
                                {(r.email && String(r.email).trim()) ||
                                  (r.co_emails &&
                                    safeParseArray(r.co_emails).join(", ")) ||
                                  "-"}
                              </td>
                              <td className="whitespace-normal break-words">
                                {(r.co_phones &&
                                  safeParseArray(r.co_phones).join(", ")) ||
                                  r.scraped_phone_number ||
                                  "-"}
                              </td>
                              <td>{r.specialty || "-"}</td>
                              <td>{fmtDate(r.updated_at || r.created_at)}</td>
                            </tr>
                          ) : (
                            <tr key={r.company_id}>
                              <td>{r.company_id}</td>
                              <td>{r.name || "-"}</td>
                              <td>{r.region || "-"}</td>
                              <td>{r.email || "-"}</td>
                              <td>{r.phone || "-"}</td>
                              <td>{fmtDate(r.updated_at || r.created_at)}</td>
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
                      disabled={page <= 1}
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
                      disabled={page * pageSize >= total}
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
