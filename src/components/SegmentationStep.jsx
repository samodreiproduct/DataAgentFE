// =======================================
// File: src/components/SegmentationStep.jsx
// =======================================
import React from "react";
import StepSection from "./StepSection";

export default function SegmentationStep({
  prevStep,
  nextStep,
  createSegment,
}) {
  return (
    <StepSection>
      <div id="segmentation">
        <div className="step-header">
          <h1 className="step-title">🎯 Segmentation & Scoring</h1>
          <p className="step-description">
            Organize your leads into targeted segments for better campaign
            performance
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">Create New Segment</label>
          <input
            type="text"
            className="form-input"
            placeholder="Enter segment name (e.g., 'Fintech India CMOs')"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Segmentation Criteria</label>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Industry</label>
              <select className="form-select">
                <option>All Industries</option>
                <option>SaaS</option>
                <option>Fintech</option>
                <option>E-commerce</option>
                <option>Healthcare</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Geography</label>
              <select className="form-select">
                <option>All Regions</option>
                <option>India</option>
                <option>United States</option>
                <option>Europe</option>
                <option>Asia-Pacific</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Company Size</label>
              <select className="form-select">
                <option>All Sizes</option>
                <option>1-10</option>
                <option>11-50</option>
                <option>51-200</option>
                <option>200+</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Min Confidence Score</label>
              <input
                type="range"
                min="0"
                max="100"
                defaultValue="70"
                style={{ width: "100%", marginBottom: "0.5rem" }}
              />
              <span style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                70%
              </span>
            </div>
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
          Existing Segments
        </h3>

        <div className="segment-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
              marginBottom: "1rem",
            }}
          >
            <h4 className="segment-title">SaaS Executives - India</h4>
            <span className="segment-count">124 leads</span>
          </div>
          <p style={{ color: "#6b7280", marginBottom: "1rem" }}>
            CEOs and CTOs from SaaS companies in India with 50+ employees
          </p>
          <div className="segment-tags">
            <span className="tag tag-high">High Intent</span>
            <span className="tag tag-enterprise">Enterprise</span>
          </div>
        </div>

        <div className="segment-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
              marginBottom: "1rem",
            }}
          >
            <h4 className="segment-title">Fintech CMOs - Global</h4>
            <span className="segment-count">89 leads</span>
          </div>
          <p style={{ color: "#6b7280", marginBottom: "1rem" }}>
            Chief Marketing Officers from fintech companies worldwide
          </p>
          <div className="segment-tags">
            <span className="tag tag-high">High Fit</span>
            <span className="tag tag-startup">Marketing</span>
          </div>
        </div>

        <div className="segment-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
              marginBottom: "1rem",
            }}
          >
            <h4 className="segment-title">E-commerce Founders</h4>
            <span className="segment-count">67 leads</span>
          </div>
          <p style={{ color: "#6b7280", marginBottom: "1rem" }}>
            Founders and co-founders from e-commerce startups
          </p>
          <div className="segment-tags">
            <span className="tag tag-startup">Startup</span>
            <span className="tag tag-enterprise">Founder</span>
          </div>
        </div>

        <div className="button-group">
          <button className="btn btn-secondary btn-large" onClick={prevStep}>
            ← Previous Step
          </button>
          <button
            className="btn btn-primary btn-large"
            onClick={createSegment}
            style={{ marginRight: "1rem" }}
          >
            Create Segment
          </button>
          <button className="btn btn-primary btn-large" onClick={nextStep}>
            Continue to Export <span>→</span>
          </button>
        </div>
      </div>
    </StepSection>
  );
}
