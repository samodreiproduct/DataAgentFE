// =======================================
// File: src/components/ExportStep.jsx
// =======================================
import React from "react";
import StepSection from "./StepSection";

export default function ExportStep({
  selectedExport,
  handleExportCardClick,
  exportConfigVisible,
  prevStep,
  nextStep,
  startExport,
}) {
  return (
    <StepSection>
      <div id="export">
        <div className="step-header">
          <h1 className="step-title">📤 Export & Sync</h1>
          <p className="step-description">
            Choose where to send your enriched and segmented leads
          </p>
        </div>

        <div className="options-grid">
          <div
            className={`option-card ${
              selectedExport === "crm" ? "selected" : ""
            }`}
            data-export="crm"
            onClick={() => handleExportCardClick("crm")}
          >
            <div className="option-icon">🏢</div>
            <h3 className="option-title">CRM Systems</h3>
            <p className="option-desc">
              Salesforce, HubSpot, Zoho, Pipedrive integration
            </p>
          </div>

          <div
            className={`option-card ${
              selectedExport === "email" ? "selected" : ""
            }`}
            data-export="email"
            onClick={() => handleExportCardClick("email")}
          >
            <div className="option-icon">📧</div>
            <h3 className="option-title">Email Marketing</h3>
            <p className="option-desc">
              Mailchimp, ActiveCampaign, SendGrid sync
            </p>
          </div>

          <div
            className={`option-card ${
              selectedExport === "thundercall" ? "selected" : ""
            }`}
            data-export="thundercall"
            onClick={() => handleExportCardClick("thundercall")}
          >
            <div className="option-icon">📞</div>
            <h3 className="option-title">AIblast Thundercall</h3>
            <p className="option-desc">
              Integrated telecalling module for outreach
            </p>
          </div>
        </div>

        <div
          id="export-config"
          style={{ display: exportConfigVisible ? "block" : "none" }}
          className="form-section"
        >
          <h3
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "2rem",
              color: "#1f2937",
            }}
          >
            Export Configuration
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Select Segments to Export</label>
              <div className="checkbox-grid">
                <div className="checkbox-item">
                  <input
                    type="checkbox"
                    id="segment1"
                    name="segments"
                    value="SaaS Executives"
                    defaultChecked
                  />
                  <label htmlFor="segment1">
                    SaaS Executives - India (124 leads)
                  </label>
                </div>
                <div className="checkbox-item">
                  <input
                    type="checkbox"
                    id="segment2"
                    name="segments"
                    value="Fintech CMOs"
                  />
                  <label htmlFor="segment2">
                    Fintech CMOs - Global (89 leads)
                  </label>
                </div>
                <div className="checkbox-item">
                  <input
                    type="checkbox"
                    id="segment3"
                    name="segments"
                    value="E-commerce Founders"
                  />
                  <label htmlFor="segment3">
                    E-commerce Founders (67 leads)
                  </label>
                </div>
              </div>
            </div>

            <div className="form-group">
              <div className="form-group">
                <label className="form-label">Export Type</label>
                <select className="form-select">
                  <option>One-time Export</option>
                  <option>Ongoing Sync</option>
                  <option>Scheduled Export</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Destination Connection</label>
                <select className="form-select">
                  <option>Select Connection</option>
                  <option>Salesforce - Production</option>
                  <option>HubSpot - Marketing</option>
                  <option>Mailchimp - Main Account</option>
                  <option>Thundercall - Campaign Module</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="button-group">
          <button className="btn btn-secondary btn-large" onClick={prevStep}>
            ← Previous Step
          </button>
          <button
            className="btn btn-primary btn-large"
            onClick={startExport}
            style={{ marginRight: "1rem" }}
          >
            Start Export
          </button>
          <button className="btn btn-primary btn-large" onClick={nextStep}>
            Continue to Monitor <span>→</span>
          </button>
        </div>
      </div>
    </StepSection>
  );
}
