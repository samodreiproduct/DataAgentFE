import { v4 as uuidv4 } from "uuid"; // npm install uuid
import React, { useState, useRef, useEffect } from "react";
import "./styles.css";
/* Components */
import Sidebar from "./components/Sidebar";
import DataSourceStep from "./components/DataSourceStep";
import DeduplicationStep from "./components/DeduplicationStep";
import EnrichmentStep from "./components/EnrichmentStep";
import ReviewStep from "./components/ReviewStep";
import SegmentationStep from "./components/SegmentationStep";
import ExportStep from "./components/ExportStep";
import MonitorStep from "./components/MonitorStep";
import ReviewProduction from "./components/ReviewProduction";
import AuthPage from "./components/auth/AuthPage";
import OngoingSessions from "./components/OngoingSessions";

export default function SamodreiDataAgent({ authUser, onLogout }) {
  const steps = [
    "data-source",
    "ongoing-sessions",
    "deduplication",
    "enrichment",
    "review",
    "review-production",
    "segmentation",
    "export",
    "monitor",
  ];
  const [currentStep, setCurrentStep] = useState("data-source");

  // data-source states
  const [sessionId, setSessionId] = useState(null);
  const [selectedSource, setSelectedSource] = useState(null); // 'scraping' | 'upload' | 'manual'
  const [selectedExport, setSelectedExport] = useState(null); // 'crm' | 'email' | 'thundercall'
  const [filePreviewVisible, setFilePreviewVisible] = useState(false);
  const [exportConfigVisible, setExportConfigVisible] = useState(false);
  const [uploadedRows, setUploadedRows] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const newSessionForFetch = React.useCallback(() => {
    const id = uuidv4();
    setSessionId(id);
    return id;
  }, []);

  // enrichment states
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [enrichmentComplete, setEnrichmentComplete] = useState(false);

  // Navigation functions
  function showStep(stepId) {
    setCurrentStep(stepId);
  }

  function nextStep(target) {
    if (typeof target === "string" && steps.includes(target)) {
      showStep(target);
      return;
    }
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      showStep(steps[currentIndex + 1]);
    }
  }

  // Open the Ongoing Sessions screen
  function openOngoingSessions() {
    showStep("ongoing-sessions");
  }

  // Use a selected session: set sessionId and navigate to enrichment (or whichever step you prefer)
  function useSessionAndOpenEnrichment(session_id) {
    if (!session_id) return;
    setSessionId(session_id);
    showStep("enrichment");
  }

  function prevStep() {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      showStep(steps[currentIndex - 1]);
    }
  }

  // Header actions
  function goToDashboard() {
    alert("Navigating to Dashboard...");
  }
  function goToMyAgents() {
    alert("Navigating to My Agents...");
  }
  function startNewSession() {
    resetFlow();
  }
  function generateReport() {
    alert("📊 Generating comprehensive report...");
  }

  function resetFlow() {
    showStep("data-source");
    setSelectedSource(null);
    setSelectedExport(null);
    setFilePreviewVisible(false);
    setExportConfigVisible(false);
    setUploadedRows([]);
    setEnrichmentLoading(false);
    setEnrichmentComplete(false);
    // 🔑 regenerate sessionId for new workflow
    setSessionId(uuidv4());
  }

  // Data source handlers
  function handleSourceCardClick(source) {
    setSelectedSource(source);
    // hide form areas info will be handled via style display props in components
    if (source !== "upload") {
      setFilePreviewVisible(false);
    }
  }

  function handleExportCardClick(exportKey) {
    setSelectedExport(exportKey);
    setExportConfigVisible(true);
  }

  // File upload
  function handleFileUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter(Boolean);
      const rows = lines.map((ln) => ln.split(",").map((c) => c.trim()));
      setUploadedRows(rows);
      setFilePreviewVisible(true);
    };
    reader.readAsText(file);
  }

  function onFileInputChange(e) {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  }

  function onUploadAreaClick() {
    if (fileInputRef.current) fileInputRef.current.click();
  }

  function onDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  function onDragLeave(e) {
    e.preventDefault();
    setDragOver(false);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (
      e.dataTransfer &&
      e.dataTransfer.files &&
      e.dataTransfer.files.length > 0
    ) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }

  // Enrichment flow (simulate)
  function startEnrichment() {
    setEnrichmentLoading(true);
    setEnrichmentComplete(false);

    setTimeout(() => {
      setEnrichmentLoading(false);
      setEnrichmentComplete(true);

      setTimeout(() => {
        setEnrichmentComplete(false);
      }, 2000);
    }, 3000);
  }

  function bulkApprove() {
    alert("Selected leads have been approved for campaign use.");
  }

  function createSegment() {
    alert("New segment created successfully!");
  }

  function startExport() {
    alert(
      "Export process started! Your leads are being synced to the selected destination."
    );
  }

  function startNewCampaign() {
    alert("Ready to start a new campaign with your enriched leads!");
  }

  // Setup event listeners if needed (not necessary as we use React handlers)
  useEffect(() => {
    setSessionId(uuidv4());
  }, []);

  // Render
  return (
    <div>
      {/* Header (kept here to preserve exact markup & classes) */}
      <header className="header">
        <div className="nav-container">
          <div
            className="logo"
            onClick={goToDashboard}
            style={{ cursor: "pointer" }}
          >
            <div className="logo-icon">S</div>
            <div className="logo-text">
              <div className="logo-main">Samodrei</div>
              <div className="logo-subtitle">AI AGENTS FOR PHARMA</div>
            </div>
          </div>

          <div className="breadcrumb">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                goToDashboard();
              }}
            >
              Dashboard
            </a>
            <span>{">"}</span>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                goToMyAgents();
              }}
            >
              My Agents
            </a>
            <span>{">"}</span>
            <span>Data Agent</span>
          </div>

          <div className="user-info">
            {/* <span>Data Manager</span> */}
            <span>{authUser.email}</span>
            <span className="role-badge">User</span>
            <button className="btn btn-secondary btn-small" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="main-container">
        <Sidebar
          currentStep={currentStep}
          showStep={showStep}
          startNewSession={startNewSession}
          generateReport={generateReport}
        />

        <main className="main-content">
          {/* Step 1: Data Source */}
          {currentStep === "data-source" && (
            <DataSourceStep
              sessionId={sessionId}
              newSessionForFetch={newSessionForFetch}
              selectedSource={selectedSource}
              handleSourceCardClick={handleSourceCardClick}
              dragOver={dragOver}
              onUploadAreaClick={onUploadAreaClick}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              fileInputRef={fileInputRef}
              onFileInputChange={onFileInputChange}
              filePreviewVisible={filePreviewVisible}
              setFilePreviewVisible={setFilePreviewVisible}
              uploadedRows={uploadedRows}
              setUploadedRows={setUploadedRows}
              nextStep={nextStep}
              openOngoingSessions={openOngoingSessions}
            />
          )}
          {/* Ongoing Sessions */}
          {currentStep === "ongoing-sessions" && (
            <OngoingSessions
              // pass helpers so the component can tell parent to open a session or go back
              onUseSession={(session_id) =>
                useSessionAndOpenEnrichment(session_id)
              }
              onBack={() => showStep("data-source")}
              // pass auth if the component needs to call APIs and include user id / tokens
              authUser={authUser}
            />
          )}

          {/* Step 2: Deduplication */}
          {currentStep === "deduplication" && (
            <DeduplicationStep
              sessionId={sessionId}
              prevStep={prevStep}
              nextStep={nextStep}
            />
          )}

          {/* Step 3: Enrichment */}
          {currentStep === "enrichment" && (
            <EnrichmentStep
              sessionId={sessionId}
              prevStep={prevStep}
              nextStep={nextStep}
              startEnrichment={startEnrichment}
              enrichmentLoading={enrichmentLoading}
              enrichmentComplete={enrichmentComplete}
            />
          )}

          {/* Step 4: Review */}
          {currentStep === "review" && (
            <ReviewStep
              sessionId={sessionId}
              prevStep={prevStep}
              nextStep={nextStep}
              bulkApprove={bulkApprove}
            />
          )}
          {/* Step 4.5: Review Production */}
          {currentStep === "review-production" && (
            <ReviewProduction
              // pass anything it needs — at minimum navigation helpers so user can go back/forward
              prevStep={prevStep}
              nextStep={nextStep}
              // optionally pass sessionId if ReviewProduction will use it
              sessionId={sessionId}
            />
          )}

          {/* Step 5: Segmentation */}
          {currentStep === "segmentation" && (
            <SegmentationStep
              sessionId={sessionId}
              prevStep={prevStep}
              nextStep={nextStep}
              createSegment={createSegment}
            />
          )}

          {/* Step 6: Export */}
          {currentStep === "export" && (
            <ExportStep
              sessionId={sessionId}
              selectedExport={selectedExport}
              handleExportCardClick={handleExportCardClick}
              exportConfigVisible={exportConfigVisible}
              prevStep={prevStep}
              nextStep={nextStep}
              startExport={startExport}
            />
          )}

          {/* Step 7: Monitor */}
          {currentStep === "monitor" && (
            <MonitorStep
              sessionId={sessionId}
              prevStep={prevStep}
              startNewCampaign={startNewCampaign}
              resetFlow={resetFlow}
            />
          )}
        </main>
      </div>
    </div>
  );
}
