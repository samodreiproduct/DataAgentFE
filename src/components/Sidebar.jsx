// =======================================
// File: src/components/Sidebar.jsx
// =======================================
import React from "react";

export default function Sidebar({
  currentStep,
  showStep,
  startNewSession,
  generateReport,
}) {
  return (
    <aside className="sidebar">
      <div className="agent-header">
        <div className="agent-icon">🤖</div>
        <div className="agent-title">Data Agent</div>
        <div className="agent-status">Active Session</div>
      </div>

      <nav className="workflow-nav">
        <li>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              showStep("data-source");
            }}
            className={currentStep === "data-source" ? "active" : ""}
          >
            <span className="step-number">1</span>
            Data Source
          </a>
        </li>
        <li>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              showStep("deduplication");
            }}
            className={currentStep === "deduplication" ? "active" : ""}
          >
            <span className="step-number">2</span>
            Deduplication
          </a>
        </li>
        <li>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              showStep("enrichment");
            }}
            className={currentStep === "enrichment" ? "active" : ""}
          >
            <span className="step-number">3</span>
            Enrichment
          </a>
        </li>
        <li>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              showStep("review");
            }}
            className={currentStep === "review" ? "active" : ""}
          >
            <span className="step-number">4</span>
            Review
          </a>
        </li>
        <li>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              showStep("review-production");
            }}
            className={currentStep === "review-production" ? "active" : ""}
          >
            <span className="step-number">5</span>
            Review Production
          </a>
        </li>

        <li>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              showStep("segmentation");
            }}
            className={currentStep === "segmentation" ? "active" : ""}
          >
            <span className="step-number">6</span>
            Segmentation
          </a>
        </li>
        <li>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              showStep("export");
            }}
            className={currentStep === "export" ? "active" : ""}
          >
            <span className="step-number">7</span>
            Export
          </a>
        </li>
        <li>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              showStep("monitor");
            }}
            className={currentStep === "monitor" ? "active" : ""}
          >
            <span className="step-number">8</span>
            Monitor
          </a>
        </li>
      </nav>

      <div
        style={{
          marginTop: 30,
          paddingTop: 20,
          borderTop: "1px solid #e5e7eb",
        }}
      >
        <button
          className="btn btn-primary"
          style={{ width: "100%" }}
          onClick={startNewSession}
        >
          🚀 Start New Session
        </button>
        <button
          className="btn btn-outline"
          style={{ width: "100%", marginTop: 10 }}
          onClick={generateReport}
        >
          📊 Generate Report
        </button>
      </div>
    </aside>
  );
}
