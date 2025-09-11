// =======================================
// File: src/components/MonitorStep.jsx
// =======================================
import React from "react";
import StepSection from "./StepSection";

export default function MonitorStep({ prevStep, startNewCampaign, resetFlow }) {
  return (
    <StepSection>
      <div id="monitor">
        <div className="step-header">
          <h1 className="step-title">📊 Monitor & Results</h1>
          <p className="step-description">
            Track your lead generation performance and campaign results
          </p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">1,247</div>
            <div className="stat-label">Total Leads Generated</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">892</div>
            <div className="stat-label">Successfully Enriched</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">756</div>
            <div className="stat-label">Approved & Exported</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">23%</div>
            <div className="stat-label">Response Rate</div>
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
          Recent Exports
        </h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Segment</th>
              <th>Destination</th>
              <th>Leads Count</th>
              <th>Export Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>SaaS Executives - India</td>
              <td>Salesforce</td>
              <td>124</td>
              <td>Today, 2:30 PM</td>
              <td>
                <span className="status-approved">Completed</span>
              </td>
              <td>
                <button
                  className="btn btn-primary"
                  style={{ padding: "0.5rem 1rem" }}
                >
                  View Details
                </button>
              </td>
            </tr>
            <tr>
              <td>Fintech CMOs - Global</td>
              <td>Mailchimp</td>
              <td>89</td>
              <td>Today, 1:15 PM</td>
              <td>
                <span className="status-approved">Completed</span>
              </td>
              <td>
                <button
                  className="btn btn-primary"
                  style={{ padding: "0.5rem 1rem" }}
                >
                  View Details
                </button>
              </td>
            </tr>
            <tr>
              <td>E-commerce Founders</td>
              <td>Thundercall</td>
              <td>67</td>
              <td>Yesterday, 4:45 PM</td>
              <td>
                <span className="status-enriched">In Progress</span>
              </td>
              <td>
                <button
                  className="btn btn-primary"
                  style={{ padding: "0.5rem 1rem" }}
                >
                  Monitor
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <h3
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            margin: "2rem 0 1rem",
            color: "#1f2937",
          }}
        >
          Campaign Performance
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
            <h4 className="segment-title">SaaS Executives Email Campaign</h4>
            <span
              style={{
                background: "#d1fae5",
                color: "#065f46",
                padding: "0.5rem 1rem",
                borderRadius: "50px",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              23% Response Rate
            </span>
          </div>
          <p style={{ color: "#6b7280", marginBottom: "2rem" }}>
            124 leads contacted • 29 responses • 12 qualified leads • 3 meetings
            scheduled
          </p>
          <div className="stats-grid">
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: "var(--accent-blue)",
                }}
              >
                29
              </div>
              <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                Responses
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: "var(--accent-blue)",
                }}
              >
                12
              </div>
              <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                Qualified
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: "var(--accent-blue)",
                }}
              >
                3
              </div>
              <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                Meetings
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: "var(--accent-blue)",
                }}
              >
                $2.4K
              </div>
              <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                Pipeline Value
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
            onClick={startNewCampaign}
            style={{ marginRight: "1rem" }}
          >
            Start New Campaign
          </button>
          <button className="btn btn-primary btn-large" onClick={resetFlow}>
            Reset Flow
          </button>
        </div>
      </div>
    </StepSection>
  );
}
