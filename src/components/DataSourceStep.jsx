import React, { useState, useEffect } from "react";
import StepSection from "./StepSection";
import Papa from "papaparse"; // for csv preview
import * as XLSX from "xlsx"; // for excel preview
import { useLeadFlow } from "../context/LeadFlowContext"; // ✅ context
import PhoneList from "../reusableComponents/PhoneList";
import FaxList from "../reusableComponents/FaxList";
import { getAuthHeaders, getAuthUser } from "../context/LeadFlowContext";
const API_BASE = import.meta.env.VITE_API_BASE;

// -- phone helpers (de-dupe & pretty) --
const DIGITS = /\d/g;
const digitsOnly = (s) => (s ? (s + "").match(DIGITS)?.join("") ?? "" : "");
const prettyPhone = (d) =>
  d.length === 11 && d.startsWith("1")
    ? prettyPhone(d.slice(1))
    : d.length === 10
    ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
    : d;

const collectPhonesFromAddresses = (addresses = []) => {
  const seen = new Set();
  const out = [];
  for (const a of addresses) {
    const raw = a?.telephone_number || a?.phone || "";
    const d = digitsOnly(raw);
    if (d && !seen.has(d)) {
      seen.add(d);
      out.push(prettyPhone(d));
    }
  }
  return out;
};

const collectFaxesFromAddresses = (addresses = []) => {
  const seen = new Set();
  const out = [];
  for (const a of addresses) {
    const raw = a?.fax_number || "";
    const d = digitsOnly(raw);
    if (d && !seen.has(d)) {
      seen.add(d);
      out.push(prettyPhone(d)); // reuse phone formatter for fax
    }
  }
  return out;
};

const usStates = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];

const PERSON_FIELDS = [
  "npi",
  "first_name",
  "last_name",
  "email",
  "phone_number",
  "fax",
  "specialty",
  "mailing_address",
  "primary_address",
  "secondary_address",
  "degree",
  "linkedin",
];

const COMPANY_FIELDS = [
  "name",
  "address",
  "phone",
  "email",
  "website",
  "linkedin_url",
  "nature_of_company",
  "region",
];

export default function DataSourceStep({
  sessionId,
  newSessionForFetch,
  selectedSource,
  handleSourceCardClick,
  dragOver,
  onUploadAreaClick,
  onDragOver,
  onDragLeave,
  onDrop,
  fileInputRef,
  filePreviewVisible,
  setFilePreviewVisible,
  uploadedRows,
  setUploadedRows,
  nextStep,
}) {
  const { updateFlowData } = useLeadFlow();
  const [scrapeResults, setScrapeResults] = useState([]);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState(null);
  // Pagination for scraping results (frontend)
  const [scrapePage, setScrapePage] = useState(0);
  const SCRAPE_PAGE_SIZE = 50;
  // file preview / upload rows come from parent props (uploadedRows)
  // Pagination for uploaded file preview
  const [uploadPage, setUploadPage] = useState(0);
  const UPLOAD_PAGE_SIZE = 50;
  const [speciality, setSpeciality] = useState("");
  const [regionScope, setRegionScope] = useState("");
  const [uploadTarget, setUploadTarget] = useState("");
  const [primaryKey, setPrimaryKey] = useState("");
  const [specialityPlaceholder, setSpecialityPlaceholder] = useState(
    "Enter specific niche"
  );
  const [isNPI, setIsNPI] = useState(false);
  // Manual-entry state
  const [manualType, setManualType] = useState("Company"); // "Company" | "Healthcare"
  const [manualLoading, setManualLoading] = useState(false);

  // Company manual form state (keeps existing fields)
  const [manualCompany, setManualCompany] = useState({
    fullName: "",
    email: "",
    companyName: "",
    jobTitle: "",
    linkedIn: "",
    phone: "",
    notes: "",
  });

  // Healthcare manual form state
  const [manualHealth, setManualHealth] = useState({
    fullName: "",
    npi: "",
    phone: "",
    specialty: "",
    fax: "",
    mailingAddress: "",
    primaryAddress: "",
    secondaryAddress: "",
    email: "",
  });
  function onChangeManualCompany(e) {
    const { name, value } = e.target;
    setManualCompany((s) => ({ ...s, [name]: value }));
  }

  function onChangeManualHealth(e) {
    const { name, value } = e.target;
    setManualHealth((s) => ({ ...s, [name]: value }));
  }

  // Simple validation errors
  const [manualErrors, setManualErrors] = useState({});

  const specialityHints = {
    SaaS: "e.g., Project Management, CRM Tools, Analytics Platforms",
    Fintech: "e.g., Payment Gateways, Lending Platforms, Crypto Exchanges",
    "E-commerce": "e.g., Fashion, Electronics, Home Decor",
    Healthcare: "e.g., Dermatology, Cardiology, Orthopedics",
    Education: "e.g., Online Courses, EdTech Platforms, Tutoring Services",
    Manufacturing:
      "e.g., Automotive Parts, Electronics Manufacturing, Textiles",
  };

  const [headerWarning, setHeaderWarning] = useState(""); // 🔔 NEW
  const [totalRows, setTotalRows] = useState(0);
  const [mappingSummary, setMappingSummary] = useState(null);
  const [editingMapping, setEditingMapping] = useState(false);

  async function handleFileInputChange(e) {
    const authHeaders = getAuthHeaders();
    const file = e.target.files[0];
    if (!file) return;

    if (!uploadTarget) {
      alert("Please select Healthcare or Company before uploading");
      return;
    }

    // 🔑 Use the same session system from SamodreiDataAgent
    const sid = newSessionForFetch();

    // Preview rows + header extraction
    let previewRows = [];
    let headerRow = [];

    if (file.name.endsWith(".csv")) {
      const results = await new Promise((resolve) => {
        Papa.parse(file, {
          header: true, // ✅ try to read headers
          complete: (res) => resolve(res),
        });
      });

      previewRows = results.data.slice(0, 50); // first 5 data rows
      headerRow = results.meta.fields || []; // column headers
    } else {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      // Convert to array-of-arrays first
      const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      headerRow = allRows[0] || []; // take first row as header
      const rawRows = allRows.slice(1, 50); // first 5 rows of data

      // Map rows into objects keyed by header
      previewRows = rawRows.map((r) =>
        Object.fromEntries(
          headerRow.map((h, i) => [h || `col${i + 1}`, r[i] || ""])
        )
      );
    }

    // 🔑 Fallback: auto-generate headers if missing
    let autoGenerated = false;
    if (
      !headerRow ||
      headerRow.length === 0 ||
      headerRow.every((h) => !h || /^\d+$/.test(h))
    ) {
      headerRow = previewRows[0]?.map((_, idx) => `col${idx + 1}`) || [];
      autoGenerated = true;
    }
    // ✅ Ensure previewRows are rebuilt with new headers if auto-generated
    if (autoGenerated) {
      previewRows = previewRows.map((r) =>
        Object.fromEntries(
          headerRow.map((h, i) => [h, Object.values(r)[i] || ""])
        )
      );
    }

    // Show toast if headers were auto-generated
    if (autoGenerated) {
      setHeaderWarning(
        "⚠ No headers detected — using default column names (col1, col2, …)"
      );
    } else {
      setHeaderWarning(""); // clear if headers are valid
    }

    // Update preview for UI
    setUploadedRows(previewRows);
    setFilePreviewVisible(true);

    // ✅ Prepare upload request ONCE
    const formData = new FormData();
    formData.append("file", file);
    formData.append("data_nature", uploadTarget);
    formData.append("session_id", sid);

    // ✅ Build mapping safely from headerRow
    const mapping = {};
    headerRow.forEach((col) => {
      if (col) mapping[col.toLowerCase()] = col;
    });
    formData.append("column_mapping", JSON.stringify(mapping)); // 🔥 REQUIRED
    formData.append("primary_key", primaryKey || "");

    const resp = await fetch(`${API_BASE}/upload-csv`, {
      method: "POST",
      headers: {
        ...authHeaders,
      },
      body: formData,
    });

    if (!resp.ok) {
      console.error(await resp.text());
      alert("Upload failed");
      return;
    }

    const data = await resp.json();
    console.log("Upload response:", data);
    setTotalRows(data.original_rows); // or rows_after_deduplication
    setMappingSummary({
      final_mapping: data.final_mapping,
      primary_key_used: data.primary_key_used,
    });

    // ✅ Push dedup stats + source type into context
    updateFlowData(sid, {
      uploadedData: data.unique_data, // full data
      columns: data.columns_detected, // no need to add email forcefully
      dedupStats: {
        total_rows: data.original_rows,
        unique_rows: data.rows_after_deduplication,
        duplicates_found: data.duplicates_removed,
        actions_taken: 0, // silent for upload
      },
      sourceType: "upload", // mark upload vs scraping
    });

    // Show only first 100 rows in preview
    setUploadedRows(data.unique_data);
    setUploadPage(0);
  }

  async function saveMapping() {
    const resp = await fetch(`${API_BASE}/remap-columns`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        session_id: sessionId,
        column_mapping: JSON.stringify(mappingSummary.final_mapping),
      }),
    });

    if (!resp.ok) {
      alert("Failed to update mapping");
      return;
    }
    const data = await resp.json();
    console.log("Remapped data:", data);

    // update preview rows
    setUploadedRows(data.remapped_data.slice(0, 100));

    // update flow context BUT do not overwrite stats
    updateFlowData(sessionId, {
      uploadedData: data.remapped_data,
      columns: Object.keys(data.remapped_data[0] || {}),
    });

    setMappingSummary((prev) => ({
      ...prev,
      final_mapping: data.final_mapping,
    }));

    setEditingMapping(false);
  }

  function recomputeIsNPI() {
    const geo = document.getElementById("target-geography-select")?.value;
    const ind = document.getElementById("industry-focus-select")?.value;
    const npi = geo === "United States" && ind === "Healthcare";
    setIsNPI(npi);
    if (!npi) setRegionScope("");
  }

  useEffect(() => {
    recomputeIsNPI();
  }, [selectedSource]);

  // inside useEffect
  useEffect(() => {
    if (headerWarning) {
      const timer = setTimeout(() => setHeaderWarning(""), 8000); // auto-hide after 8s
      return () => clearTimeout(timer);
    }
  }, [headerWarning]);

  function gatherScrapeFormValues() {
    const geography =
      document.getElementById("target-geography-select")?.value || "";
    const industry =
      document.getElementById("industry-focus-select")?.value || "";

    const roleNodes = document.querySelectorAll(
      '#scraping-form input[name="roles"]:checked'
    );
    const roles = Array.from(roleNodes).map((n) => n.value);
    return { geography, industry, roles };
  }

  // ---------- NPI helpers ----------
  const formatAddress = (addr = {}) => {
    const parts = [
      addr.address_1,
      addr.address_2,
      [addr.city, addr.state].filter(Boolean).join(", "),
      addr.postal_code,
    ].filter(Boolean);
    return parts.length ? parts.join(" • ") : "-";
  };

  // derived slices for pagination
  const pagedScrapeRows = scrapeResults.slice(
    scrapePage * SCRAPE_PAGE_SIZE,
    (scrapePage + 1) * SCRAPE_PAGE_SIZE
  );

  const scrapeTotalPages = Math.max(
    1,
    Math.ceil(scrapeResults.length / SCRAPE_PAGE_SIZE)
  );

  const pagedUploadRows = (uploadedRows || []).slice(
    uploadPage * UPLOAD_PAGE_SIZE,
    (uploadPage + 1) * UPLOAD_PAGE_SIZE
  );
  const uploadTotalPages = Math.max(
    1,
    Math.ceil((uploadedRows || []).length / UPLOAD_PAGE_SIZE)
  );

  const nameFromNpiResult = (r = {}) => {
    const basic = r.basic || {};
    const fn = basic.first_name?.trim();
    const ln = basic.last_name?.trim();
    if (fn || ln) return [fn, ln].filter(Boolean).join(" ");

    const authFn = r.authorized_official_first_name?.trim();
    const authLn = r.authorized_official_last_name?.trim();
    if (authFn || authLn) return [authFn, authLn].filter(Boolean).join(" ");

    return basic.organization_name || "-";
  };

  const mapNpiResults = (items = []) =>
    items.map((r) => {
      const basic = r.basic || {};
      const taxonomies = r.taxonomies || [];
      const primaryTax =
        taxonomies.find((t) => t.primary) || taxonomies[0] || {};
      const addresses = r.addresses || [];
      const mailing =
        addresses.find((a) => a.address_purpose === "MAILING") || {};
      const primary =
        addresses.find((a) => a.address_purpose === "LOCATION") || {};
      const practiceLocations = r.practiceLocations || [];
      const secondary = practiceLocations.length
        ? practiceLocations.map(formatAddress).join(" | ")
        : "";

      // name logic (unchanged)
      let name = "-";
      const enumType = (r.enumeration_type || "").toUpperCase();
      if (enumType === "NPI-1") {
        name =
          [basic.first_name, basic.last_name].filter(Boolean).join(" ") || "-";
      } else if (enumType === "NPI-2") {
        const authFirst = basic.authorized_official_first_name || "";
        const authMiddle = basic.authorized_official_middle_name || "";
        const authLast = basic.authorized_official_last_name || "";
        const authorized = [authFirst, authMiddle, authLast]
          .filter(Boolean)
          .join(" ")
          .trim();
        name = authorized || basic.organization_name || "-";
      } else {
        name =
          basic.organization_name ||
          [basic.first_name, basic.last_name].filter(Boolean).join(" ") ||
          "-";
      }
      // ✅ phones: prefer backend's enriched array if present; else compute locally
      const enriched = r.enriched_data || {};
      const phonesArray =
        (Array.isArray(enriched.phone_numbers) && enriched.phone_numbers.length
          ? enriched.phone_numbers
          : collectPhonesFromAddresses(addresses)) || [];
      const phonesJoined = phonesArray.length
        ? phonesArray.join(", ")
        : enriched.phone_number || "";

      // ✅ faxes (NEW)
      const faxesArray =
        (Array.isArray(enriched.fax_numbers) && enriched.fax_numbers.length
          ? enriched.fax_numbers
          : collectFaxesFromAddresses(addresses)) || [];
      const faxesJoined = faxesArray.length
        ? faxesArray.join(", ")
        : enriched.fax || primary.fax_number || mailing.fax_number || "";

      // ✅ specialty: prefer backend’s chosen match (e.g., “Pharmacist – Cardiology”)
      const specialty = enriched.specialty || primaryTax.desc || "-";

      return {
        npi: r.number || "-",
        name,
        email: basic.email || "-",
        phones: phonesArray, // <-- array for UI chips
        phone: phonesJoined, // <-- legacy string
        fax_numbers: faxesArray,
        fax: faxesJoined,
        specialty,
        addressMailing: formatAddress(mailing),
        addressPrimary: formatAddress(primary),
        addressSecondary: secondary || "-",
      };
    });

  async function handleManualContinue() {
    const auth = getAuthUser();
    const srcUser = auth?.user_id || undefined;
    // only act when manual is selected
    if (selectedSource !== "manual") {
      nextStep();
      return;
    }

    // Client-side validation
    if (manualType === "Healthcare") {
      const errs = {};
      if (!manualHealth.fullName || manualHealth.fullName.trim() === "") {
        errs.fullName = "Full Name is required for Healthcare";
        setManualErrors(errs);
        return;
      }
    }

    setManualErrors({});
    setManualLoading(true);

    try {
      // Build payload expected by backend
      const payload = {
        type: manualType === "Healthcare" ? "person" : "company",
        session_id:
          sessionId ||
          (typeof newSessionForFetch === "function" && newSessionForFetch()) ||
          undefined,
        data:
          manualType === "Healthcare"
            ? {
                fullName: manualHealth.fullName,
                npi: manualHealth.npi,
                phone: manualHealth.phone,
                specialty: manualHealth.specialty,
                fax: manualHealth.fax,
                mailingAddress: manualHealth.mailingAddress,
                primaryAddress: manualHealth.primaryAddress,
                secondaryAddress: manualHealth.secondaryAddress,
                email: manualHealth.email,
              }
            : {
                fullName: manualCompany.fullName,
                email: manualCompany.email,
                companyName: manualCompany.companyName,
                jobTitle: manualCompany.jobTitle,
                linkedIn: manualCompany.linkedIn,
                phone: manualCompany.phone,
                notes: manualCompany.notes,
              },
      };

      const resp = await fetch(`${API_BASE}/manual-entry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const body = await resp.json();
      if (!resp.ok) {
        const errMsg = body?.detail || body?.message || JSON.stringify(body);
        throw new Error(errMsg);
      }

      // backend returns mapping_id and session_id (and message)
      const mappingId = body.mapping_id;
      const sid = body.session_id || payload.session_id;

      // Update flow context so enrichment step can read it
      // set uploadedData to array with the single record so enrichment UI shows it
      const uploadedData =
        manualType === "Healthcare"
          ? [
              {
                npi: manualHealth.npi || "",
                name: manualHealth.fullName,
                email: manualHealth.email || "",
                phone: manualHealth.phone || "",
                fax: manualHealth.fax || "",
                specialty: manualHealth.specialty || "",
                addressMailing: manualHealth.mailingAddress || "",
                addressPrimary:
                  manualHealth.primaryAddress || manualHealth.address || "",
                addressSecondary: manualHealth.secondaryAddress || "",
                session_id: sid,
                mapping_id: mappingId,
              },
            ]
          : [
              {
                name: manualCompany.companyName || manualCompany.fullName || "",
                fullName: manualCompany.fullName || "",
                email: manualCompany.email || "",
                phone: manualCompany.phone || "",
                linkedin: manualCompany.linkedIn || "",
                title: manualCompany.jobTitle || "",
                notes: manualCompany.notes || "",
                session_id: sid,
                mapping_id: mappingId,
              },
            ];

      updateFlowData(sid, {
        uploadedData,
        columns: Object.keys(uploadedData[0] || {}),
        dedupStats: {
          total_rows: 1,
          unique_rows: 1,
          duplicates_found: 0,
          actions_taken: 0,
        },
        sourceType: "manual",
        sourceSubtype: manualType === "Healthcare" ? "healthcare" : "company",
        skipDedup: manualType === "Healthcare" ? true : false,
        mapping_id: mappingId,
      });

      // Navigate to next step. Parent should read skipDedup and route to enrichment.
      nextStep();
    } catch (err) {
      console.error("Manual entry failed:", err);
      alert("Failed to save manual entry: " + (err.message || err));
    } finally {
      setManualLoading(false);
    }
  }

  // ---------- fetch ----------
  // ---------- fetch ----------
  async function handleStartScraping() {
    const authHeaders = getAuthHeaders();
    const auth = getAuthUser();
    setScrapeError(null);
    setScrapeLoading(true);
    // 🔑 always start fresh session for each fetch
    const sid = newSessionForFetch(); // <-- from parent (SamodreiDataAgent)
    console.log("🔄 New Session for fetch:", sid);

    const { geography, industry, roles } = gatherScrapeFormValues();

    if (!geography || geography === "Select Region") {
      setScrapeError("Please select a target geography.");
      setScrapeLoading(false);
      return;
    }
    if (!industry || industry === "Select Industry") {
      setScrapeError("Please select an Industry Focus.");
      setScrapeLoading(false);
      return;
    }
    if (!speciality || speciality.trim() === "") {
      setScrapeError("Please enter a Speciality / Niche.");
      setScrapeLoading(false);
      return;
    }

    // Enforce state selection for NPI
    if (geography === "United States" && industry === "Healthcare") {
      if (!regionScope || !usStates.includes(regionScope)) {
        setScrapeError("Please select a valid U.S. state.");
        setScrapeLoading(false);
        return;
      }
    }

    try {
      if (geography === "United States" && industry === "Healthcare") {
        // ---------- NPI SCRAPING ----------
        const resp = await fetch(`${API_BASE}/healthcare-speciality`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({
            region: regionScope,
            specialty: speciality,
            session_id: sid, // ✅ passed from parent
          }),
        });

        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(`Server responded ${resp.status}: ${txt}`);
        }

        const data = await resp.json();
        console.log("📥 NPI API Response:", data);

        // ---------- Flatten / sanitize leads for staging DB ----------
        const sanitizedLeads = (data.results || []).map((lead) => ({
          npi: lead.npi || "-",
          name: lead.name || "-",
          email: lead.email || "-",
          phone: lead.phone || "-",
          fax: lead.fax || "-",
          specialty: lead.specialty || "-",
          addressMailing: lead.addressMailing || "-",
          addressPrimary: lead.addressPrimary || "-",
          addressSecondary: lead.addressSecondary || "-",
          session_id: sid,
        }));

        // Update state to show in frontend table
        const mappedLeads = mapNpiResults(data.results || []);
        setScrapeResults(mappedLeads);
        setScrapePage(0);

        setScrapeError(null);
        // update flow context so dedup picks up person rows
        updateFlowData(sid, {
          uploadedData: mappedLeads,
          columns: [
            "npi",
            "name",
            "email",
            "phone",
            "fax",
            "specialty",
            "mailing_address",
            "primary_address",
            "secondary_address",
          ],
          dedupStats: {
            total_rows: mappedLeads.length,
            unique_rows: mappedLeads.length,
            duplicates_found: 0,
            actions_taken: 0,
          },
          sourceType: "scraping",
          dataNature: "person",
        });
      } else {
        // ---------- COMPANY SCRAPING ----------
        const resp = await fetch(`${API_BASE}/company-data`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({
            Nature_of_company: industry,
            region: geography,
            speciality,
            roles,
            session_id: sid,
            limit: 2,
            linkedin_scrape: false, // or true if you want LinkedIn enrichment immediately
            source_user_id: auth?.user_id || undefined,
          }),
        });

        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(`Server responded ${resp.status}: ${txt}`);
        }

        const data = await resp.json();
        const items = data?.results || []; // company-data returns `results`

        const mappedLeads = items.map((lead) => {
          return {
            // core fields returned by company endpoint
            name: lead?.name || "-",
            address: lead?.address || "-",
            phone: lead?.phone || "-",
            email: lead?.email || "-",
            website: lead?.website || "-",
            linkedin_url: lead?.linkedin_url || "",
            // legacy compatibility if other code expects these
            company: lead?.name || "-",
            title: "-",
            company_id: lead?.company_id ?? lead?.companyId ?? null,
            session_id: sid,
          };
        });
        console.log("RAW SERP:", data.raw_sample);

        setScrapeResults(mappedLeads);
        setScrapePage(0);

        // update global flow context so Deduplication step knows this is company data
        updateFlowData(sid, {
          uploadedData: mappedLeads,
          columns: [
            "name",
            "address",
            "phone",
            "email",
            "website",
            "linkedin_url",
          ],
          dedupStats: {
            total_rows: mappedLeads.length,
            unique_rows: mappedLeads.length, // backend dedupe happens on insert — adjust if you compute server-side
            duplicates_found: 0,
            actions_taken: 0,
          },
          sourceType: "scraping",
          dataNature: "company", // <-- IMPORTANT: dedup will now fetch company rows
        });
      }
    } catch (err) {
      console.error("Scrape error:", err);
      setScrapeError("Scrape failed. Check backend logs or network.");
    } finally {
      setScrapeLoading(false);
    }
  }

  return (
    <StepSection>
      <div id="data-source" className="step-section active">
        <div className="step-header">
          <h1 className="step-title">🔍 Select Data Source</h1>
          <p className="step-description">
            Choose how you want to add leads to your database
          </p>
        </div>

        <div className="options-grid">
          <div
            className={`option-card float ${
              selectedSource === "scraping" ? "selected" : ""
            }`}
            onClick={() => handleSourceCardClick("scraping")}
          >
            <div className="option-icon">🕷️</div>
            <h3 className="option-title">Rule-Based Scraping</h3>
            <p className="option-desc">
              Automatically scrape leads from LinkedIn, Clutch, AngelList, and
              more platforms
            </p>
          </div>

          <div
            className={`option-card float ${
              selectedSource === "upload" ? "selected" : ""
            }`}
            onClick={() => handleSourceCardClick("upload")}
            style={{ animationDelay: "0.2s" }}
          >
            <div className="option-icon">📁</div>
            <h3 className="option-title">File Upload</h3>
            <p className="option-desc">
              Upload CSV or Excel files with your existing lead data for
              processing
            </p>
          </div>

          <div
            className={`option-card float ${
              selectedSource === "manual" ? "selected" : ""
            }`}
            onClick={() => handleSourceCardClick("manual")}
            style={{ animationDelay: "0.4s" }}
          >
            <div className="option-icon">✍️</div>
            <h3 className="option-title">Manual Entry</h3>
            <p className="option-desc">
              Add leads one by one using our intelligent form interface
            </p>
          </div>
        </div>

        {/* Scraping Form */}
        <div
          id="scraping-form"
          className="form-section"
          style={{ display: selectedSource === "scraping" ? "block" : "none" }}
        >
          <h3
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "2rem",
              color: "#1f2937",
            }}
          >
            Configure Scraping Rules
          </h3>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Target Geography</label>
              <select
                id="target-geography-select"
                className="form-select"
                defaultValue="United States"
                onChange={recomputeIsNPI}
              >
                <option>Select Region</option>
                <option>India</option>
                <option>United States</option>
                <option>Europe</option>
                <option>Asia-Pacific</option>
                <option>Global</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Industry Focus</label>
              <select
                id="industry-focus-select"
                className="form-select"
                defaultValue="Select Industry"
                onChange={(e) => {
                  const selected = e.target.value;
                  setSpecialityPlaceholder(
                    specialityHints[selected] || "Enter specific niche"
                  );
                  recomputeIsNPI();
                }}
              >
                <option>Select Industry</option>
                <option>SaaS</option>
                <option>Fintech</option>
                <option>E-commerce</option>
                <option>Healthcare</option>
                <option>Education</option>
                <option>Manufacturing</option>
              </select>
            </div>
          </div>

          {/* State selector (NPI only) */}
          {isNPI && (
            <div className="form-group">
              <label className="form-label">Select U.S. State</label>
              <select
                className="form-select"
                value={regionScope}
                onChange={(e) => setRegionScope(e.target.value)}
              >
                <option value="">Select State</option>
                {usStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              <small className="form-text text-muted">
                State is required for NPI search.
              </small>
            </div>
          )}

          {/* Speciality/Niche Field (used as NPI specialty, e.g., "Dermatology") */}
          <div className="form-group">
            <label className="form-label">Speciality / Niche</label>
            <input
              type="text"
              className="form-input"
              placeholder={specialityPlaceholder}
              value={speciality}
              onChange={(e) => setSpeciality(e.target.value)}
            />
          </div>

          {/* Roles: hidden for NPI; show single Prescriber checkbox (disabled & checked) */}
          {isNPI ? (
            <div className="form-group">
              <label className="form-label">Role</label>
              <div className="checkbox-item">
                <input type="checkbox" checked disabled readOnly />
                <label>Prescriber</label>
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Target Roles & Titles</label>
              <div className="checkbox-grid">
                <div className="checkbox-item">
                  <input type="checkbox" id="ceo" name="roles" value="CEO" />
                  <label htmlFor="ceo">CEO / Chief Executive Officer</label>
                </div>
                <div className="checkbox-item">
                  <input type="checkbox" id="cmo" name="roles" value="CMO" />
                  <label htmlFor="cmo">CMO / Chief Marketing Officer</label>
                </div>
                <div className="checkbox-item">
                  <input type="checkbox" id="cto" name="roles" value="CTO" />
                  <label htmlFor="cto">CTO / Chief Technology Officer</label>
                </div>
                <div className="checkbox-item">
                  <input
                    type="checkbox"
                    id="founder"
                    name="roles"
                    value="Founder"
                  />
                  <label htmlFor="founder">Founder / Co-Founder</label>
                </div>
                <div className="checkbox-item">
                  <input type="checkbox" id="vp" name="roles" value="VP" />
                  <label htmlFor="vp">VP / Vice President</label>
                </div>
                <div className="checkbox-item">
                  <input
                    type="checkbox"
                    id="director"
                    name="roles"
                    value="Director"
                  />
                  <label htmlFor="director">Director / Senior Director</label>
                </div>
              </div>
            </div>
          )}

          {/* Data Source (always SERP/Google Maps) */}
          {!isNPI && (
            <div className="form-group">
              <label className="form-label">Data Source</label>
              <div className="checkbox-item">
                <input type="checkbox" checked disabled readOnly />
                <label>Google Maps (via SERP API)</label>
              </div>
            </div>
          )}

          {isNPI && (
            <div className="form-group">
              <label className="form-label">Data Source</label>
              <div className="checkbox-item">
                <input type="checkbox" checked disabled readOnly />
                <label>NPI Registry</label>
              </div>
            </div>
          )}

          {/* Fetch Leads button */}
          <div style={{ marginTop: 20 }}>
            <button
              className="btn btn-primary"
              onClick={handleStartScraping}
              disabled={scrapeLoading}
            >
              {scrapeLoading
                ? "⏳ Fetching leads..."
                : "🚀 Fetch Leads (Top 50)"}
            </button>
          </div>

          {/* Scrape Results */}
          <div className="scrape-results" style={{ marginTop: "1.5rem" }}>
            {scrapeResults.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    {isNPI ? (
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
                      </>
                    ) : (
                      <>
                        <th>Name</th>
                        <th>Address</th>
                        <th style={{ minWidth: "160px" }}>Phone</th>
                        <th>Email</th>
                        <th>Website</th>
                        <th>LinkedIn</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pagedScrapeRows.map((row, i) => {
                    const idx = scrapePage * SCRAPE_PAGE_SIZE + i;
                    return isNPI ? (
                      <tr key={idx}>
                        <td>{row.npi || "-"}</td>
                        <td>{row.name}</td>
                        <td>{row.email || "-"}</td>
                        <td className="phone">
                          <PhoneList
                            phone={row.phone}
                            phone_numbers={row.phone_numbers}
                          />
                        </td>
                        <td className="fax">
                          <FaxList
                            fax={row.fax}
                            fax_numbers={row.fax_numbers}
                          />
                        </td>
                        <td>{row.specialty || "-"}</td>
                        <td>{row.addressMailing || "-"}</td>
                        <td>{row.addressPrimary || "-"}</td>
                        <td>{row.addressSecondary || "-"}</td>
                      </tr>
                    ) : (
                      <tr key={idx}>
                        <td>{row.name}</td>
                        <td style={{ whiteSpace: "pre-wrap", maxWidth: 300 }}>
                          {row.address}
                        </td>
                        <td className="phone">
                          {row.phone
                            ? prettyPhone(digitsOnly(String(row.phone)))
                            : "-"}
                        </td>
                        <td>{row.email || "-"}</td>
                        <td>
                          {row.website ? (
                            <a
                              href={row.website}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {row.website}
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          {row.linkedin_url ? (
                            <a
                              href={row.linkedin_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              LinkedIn
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Scrape pagination controls */}
                {scrapeResults.length > SCRAPE_PAGE_SIZE && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      gap: 12,
                      marginTop: 10,
                    }}
                  >
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setScrapePage((p) => Math.max(0, p - 1))}
                      disabled={scrapePage <= 0}
                    >
                      ← Previous
                    </button>
                    <div style={{ alignSelf: "center" }}>
                      Page {scrapePage + 1} of {scrapeTotalPages}
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        setScrapePage((p) =>
                          Math.min(scrapeTotalPages - 1, p + 1)
                        )
                      }
                      disabled={scrapePage >= scrapeTotalPages - 1}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </table>
            ) : scrapeLoading ? (
              <p>⏳ Fetching leads...</p>
            ) : scrapeError ? (
              <p style={{ color: "red" }}>{scrapeError}</p>
            ) : (
              <p>No results yet.</p>
            )}
          </div>
        </div>

        {/* Upload Form */}
        <div
          id="upload-form"
          className="form-section"
          style={{ display: selectedSource === "upload" ? "block" : "none" }}
        >
          <div className="form-group">
            <label className="form-label">Select Target Table</label>
            <select
              className="form-select"
              value={uploadTarget}
              onChange={(e) => setUploadTarget(e.target.value)}
            >
              <option value="">Select...</option>
              <option value="person">Healthcare</option>
              <option value="company">Company</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Choose Primary Key</label>
            <select
              className="form-select"
              value={primaryKey}
              onChange={(e) => setPrimaryKey(e.target.value)}
            >
              <option value="">Auto (Default)</option>
              <option value="npi">NPI</option>
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="first_name">First Name</option>
              <option value="last_name">Last Name</option>
            </select>
          </div>

          {/* unchanged upload form... */}
          <h3
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "2rem",
              color: "#1f2937",
            }}
          >
            Upload Your Data File
          </h3>
          <div
            className={`upload-area ${dragOver ? "dragover" : ""}`}
            onClick={onUploadAreaClick}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <div className="upload-icon">📁</div>
            <p
              style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                marginBottom: "0.5rem",
              }}
            >
              Drop your CSV or Excel file here
            </p>
            <p style={{ color: "#6b7280" }}>
              or click to browse • Supports .csv, .xlsx, .xls
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              style={{ display: "none" }}
              ref={fileInputRef}
              onChange={handleFileInputChange}
            />
          </div>
          {filePreviewVisible && (
            <div id="file-preview">
              <h4
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  margin: "2rem 0 1rem",
                }}
              >
                File Preview
              </h4>
              <table className="data-table">
                <thead>
                  <tr>
                    {uploadedRows && uploadedRows.length > 0
                      ? Object.keys(uploadedRows[0]).map((col, i) => (
                          <th key={i}>{col}</th>
                        ))
                      : null}
                  </tr>
                </thead>
                <tbody>
                  {uploadedRows && uploadedRows.length > 0
                    ? pagedUploadRows.map((row, i) => (
                        <tr key={uploadPage * UPLOAD_PAGE_SIZE + i}>
                          {Object.values(row).map((val, j) => (
                            <td key={j}>{val}</td>
                          ))}
                        </tr>
                      ))
                    : null}
                </tbody>
              </table>
              {/* Upload preview pagination */}
              {uploadedRows && uploadedRows.length > UPLOAD_PAGE_SIZE && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 12,
                    marginTop: 10,
                  }}
                >
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setUploadPage((p) => Math.max(0, p - 1))}
                    disabled={uploadPage <= 0}
                  >
                    ← Previous
                  </button>
                  <div style={{ alignSelf: "center" }}>
                    Page {uploadPage + 1} of {uploadTotalPages}
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      setUploadPage((p) =>
                        Math.min(uploadTotalPages - 1, p + 1)
                      )
                    }
                    disabled={uploadPage >= uploadTotalPages - 1}
                  >
                    Next →
                  </button>
                </div>
              )}

              <p
                style={{
                  marginTop: "8px",
                  fontSize: "0.9rem",
                  color: "#6b7280",
                  fontStyle: "italic",
                }}
              >
                Showing first {Math.min(50, uploadedRows.length)} of {totalRows}{" "}
                rows. All rows are stored in the database.
              </p>
            </div>
          )}
          {mappingSummary && (
            <div
              style={{
                marginTop: "1rem",
                padding: "10px",
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
              }}
            >
              <strong>🗂 Column Mapping:</strong>
              <ul style={{ marginTop: "5px", fontSize: "0.9rem" }}>
                {Object.entries(mappingSummary.final_mapping || {}).map(
                  ([k, v]) => (
                    <li key={k}>
                      {k} ← <em>{v}</em>
                    </li>
                  )
                )}
              </ul>
              <p>
                <strong>Primary Key:</strong> {mappingSummary.primary_key_used}
              </p>
            </div>
          )}
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginTop: "8px" }}
            onClick={() => setEditingMapping(true)}
          >
            ✏️ Edit Mapping
          </button>

          {editingMapping && (
            <div style={{ marginTop: "1rem" }}>
              <h4>Adjust Column Mapping</h4>
              {(uploadTarget === "person" ? PERSON_FIELDS : COMPANY_FIELDS).map(
                (target) => (
                  <div key={target} className="form-group">
                    <label>{target}</label>
                    <select
                      className="form-select"
                      value={mappingSummary.final_mapping?.[target] || ""}
                      onChange={(e) =>
                        setMappingSummary((prev) => ({
                          ...prev,
                          final_mapping: {
                            ...prev.final_mapping,
                            [target]: e.target.value,
                          },
                        }))
                      }
                    >
                      <option value="">-- not mapped --</option>
                      {Object.keys(uploadedRows[0] || {}).map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              )}

              <button
                className="btn btn-primary btn-sm"
                style={{ marginTop: "10px" }}
                onClick={() => saveMapping()}
              >
                ✅ Save Mapping
              </button>
            </div>
          )}

          {headerWarning && (
            <div
              style={{
                marginTop: "10px",
                padding: "8px 12px",
                background: "#fff3cd",
                color: "#856404",
                border: "1px solid #ffeeba",
                borderRadius: "6px",
                fontSize: "0.9rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{headerWarning}</span>
              <button
                onClick={() => setHeaderWarning("")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#856404",
                  fontWeight: "bold",
                  marginLeft: "10px",
                  cursor: "pointer",
                }}
              >
                ✖
              </button>
            </div>
          )}
        </div>

        {/* Manual Entry */}
        <div
          id="manual-form"
          className="form-section"
          style={{ display: selectedSource === "manual" ? "block" : "none" }}
        >
          <h3
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "2rem",
              color: "#1f2937",
            }}
          >
            Add Lead Manually
          </h3>

          {/* Type selector */}
          <div className="form-group" style={{ marginBottom: "1rem" }}>
            <label className="form-label">Select Type</label>
            <select
              className="form-select"
              value={manualType}
              onChange={(e) => setManualType(e.target.value)}
            >
              <option value="Company">Company</option>
              <option value="Healthcare">Healthcare</option>
            </select>
          </div>

          {/* COMPANY form (kept as-is, wired to manualCompany) */}
          {manualType === "Company" ? (
            <>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    name="fullName"
                    type="text"
                    className="form-input"
                    placeholder="Enter full name"
                    value={manualCompany.fullName}
                    onChange={onChangeManualCompany}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    name="email"
                    type="email"
                    className="form-input"
                    placeholder="Enter email address"
                    value={manualCompany.email}
                    onChange={onChangeManualCompany}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Company Name</label>
                  <input
                    name="companyName"
                    type="text"
                    className="form-input"
                    placeholder="Enter company name"
                    value={manualCompany.companyName}
                    onChange={onChangeManualCompany}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Job Title</label>
                  <input
                    name="jobTitle"
                    type="text"
                    className="form-input"
                    placeholder="Enter job title"
                    value={manualCompany.jobTitle}
                    onChange={onChangeManualCompany}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">LinkedIn Profile</label>
                  <input
                    name="linkedIn"
                    type="url"
                    className="form-input"
                    placeholder="https://linkedin.com/in/profile"
                    value={manualCompany.linkedIn}
                    onChange={onChangeManualCompany}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number (Optional)</label>
                  <input
                    name="phone"
                    type="tel"
                    className="form-input"
                    placeholder="+1 (555) 123-4567"
                    value={manualCompany.phone}
                    onChange={onChangeManualCompany}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <textarea
                  name="notes"
                  className="form-input"
                  rows="3"
                  placeholder="Add any additional notes about this lead"
                  value={manualCompany.notes}
                  onChange={onChangeManualCompany}
                />
              </div>
            </>
          ) : (
            /* HEALTHCARE form */
            <>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    Full Name <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    name="fullName"
                    type="text"
                    className="form-input"
                    placeholder="Enter full name"
                    value={manualHealth.fullName}
                    onChange={onChangeManualHealth}
                  />
                  {manualErrors.fullName && (
                    <div style={{ color: "red", marginTop: 6 }}>
                      {manualErrors.fullName}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">NPI</label>
                  <input
                    name="npi"
                    type="text"
                    className="form-input"
                    placeholder="Enter NPI"
                    value={manualHealth.npi}
                    onChange={onChangeManualHealth}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    name="phone"
                    type="tel"
                    className="form-input"
                    placeholder="Enter phone number"
                    value={manualHealth.phone}
                    onChange={onChangeManualHealth}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Fax</label>
                  <input
                    name="fax"
                    type="text"
                    className="form-input"
                    placeholder="Enter fax"
                    value={manualHealth.fax}
                    onChange={onChangeManualHealth}
                  />
                </div>

                <div className="col-span-2 form-group">
                  <label className="form-label">
                    Specialty{" "}
                    <span style={{ color: "rgba(16,185,129,0.9)" }}>
                      (recommended)
                    </span>
                  </label>
                  <input
                    name="specialty"
                    type="text"
                    className="form-input"
                    placeholder="e.g., Dermatology, Cardiology"
                    value={manualHealth.specialty}
                    onChange={onChangeManualHealth}
                  />
                  <small
                    style={{ color: "#6b7280", display: "block", marginTop: 6 }}
                  >
                    Specialty helps NPI/enrichment match results — recommended
                    but optional.
                  </small>
                </div>

                <div className="form-group">
                  <label className="form-label">Mailing Address</label>
                  <input
                    name="mailingAddress"
                    type="text"
                    className="form-input"
                    placeholder="Mailing address"
                    value={manualHealth.mailingAddress}
                    onChange={onChangeManualHealth}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Primary Address</label>
                  <input
                    name="primaryAddress"
                    type="text"
                    className="form-input"
                    placeholder="Primary address"
                    value={manualHealth.primaryAddress}
                    onChange={onChangeManualHealth}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Secondary Address</label>
                  <input
                    name="secondaryAddress"
                    type="text"
                    className="form-input"
                    placeholder="Secondary address"
                    value={manualHealth.secondaryAddress}
                    onChange={onChangeManualHealth}
                  />
                </div>

                <div className="col-span-2 form-group">
                  <label className="form-label">Email</label>
                  <input
                    name="email"
                    type="email"
                    className="form-input"
                    placeholder="Enter email"
                    value={manualHealth.email}
                    onChange={onChangeManualHealth}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="button-group">
          <button
            className="btn btn-primary btn-large"
            onClick={
              selectedSource === "manual" ? handleManualContinue : nextStep
            }
            disabled={selectedSource === "manual" && manualLoading}
          >
            {selectedSource === "manual" && manualLoading
              ? "Saving…"
              : "Continue to Duplication"}
            <span> →</span>
          </button>
        </div>
      </div>
    </StepSection>
  );
}
