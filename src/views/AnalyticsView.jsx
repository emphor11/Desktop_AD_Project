// src/views/AnalyticsView.jsx
// Examiner-only performance analytics dashboard:
// Computes class performance, pass rates, score distribution (pure SVG),
// and activity interruption metrics from real saved attempts.

import React, { useState, useEffect } from "react";

export default function AnalyticsView() {
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setIsLoading(true);
    setError("");
    try {
      const data = await window.examTrace.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      setError(err.message || "Failed to load performance analytics.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return <div className="loading-placeholder">Computing performance analytics from local attempt records...</div>;
  }

  if (error) {
    return <div className="error-alert">{error}</div>;
  }

  if (!analytics || analytics.totalAttempts === 0) {
    return (
      <div className="view-container">
        <div className="view-header">
          <div>
            <h2>Performance Analytics</h2>
            <p className="subtitle">Real-time aggregate performance metrics and interruption statistics.</p>
          </div>
        </div>

        <div className="card empty-state">
          <h4>No Examination Attempts Recorded</h4>
          <p>
            Analytics are computed exclusively from real candidate attempts stored on this device.
            Once examinations are taken and submitted, this view will show score distributions,
            pass rates, and activity interruption metrics.
          </p>
        </div>
      </div>
    );
  }

  // Calculate maximum bucket count for SVG chart scaling
  const maxBucketCount = Math.max(1, ...analytics.distribution.map((d) => d.count));
  const svgHeight = 180;
  const svgWidth = 480;
  const barWidth = 60;
  const gap = 36;

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h2>Performance Analytics</h2>
          <p className="subtitle">
            Aggregate performance computed from {analytics.totalAttempts} completed attempt(s) on this device.
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadAnalytics}>
          ↻ Refresh Analytics
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{analytics.totalAttempts}</div>
          <div className="stat-label">Total Attempts Taken</div>
        </div>

        <div className="stat-card" style={{ borderColor: "rgba(59, 130, 246, 0.4)" }}>
          <div className="stat-value" style={{ color: "var(--color-primary)" }}>
            {analytics.averageScore}
          </div>
          <div className="stat-label">Average Score (Mean)</div>
        </div>

        <div className="stat-card" style={{ borderColor: analytics.passRate >= 60 ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)" }}>
          <div className="stat-value" style={{ color: analytics.passRate >= 60 ? "#34d399" : "#f87171" }}>
            {analytics.passRate}%
          </div>
          <div className="stat-label">Pass Rate (≥ 60%)</div>
        </div>

        <div className="stat-card">
          <div className="stat-value" style={{ color: "#34d399" }}>{analytics.highestScore}</div>
          <div className="stat-label">Highest Score Achieved</div>
        </div>
      </div>

      {/* Two Column Layout: Score Distribution SVG Chart & Monitoring Interruption Totals */}
      <div className="grid-2col" style={{ marginTop: "24px" }}>
        {/* Score Distribution Chart */}
        <div className="card">
          <div className="card-title">
            <span>Score Distribution (Candidate Percentages)</span>
          </div>
          <p style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "16px" }}>
            Histogram distribution across five score bands. Rendered with native vector SVG.
          </p>

          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}>
            <svg width={svgWidth} height={svgHeight} style={{ overflow: "visible" }}>
              {/* Baseline */}
              <line x1="20" y1="140" x2={svgWidth - 20} y2="140" stroke="var(--color-border)" strokeWidth="1" />

              {analytics.distribution.map((item, index) => {
                const x = 35 + index * (barWidth + gap);
                const barHeight = Math.max(4, (item.count / maxBucketCount) * 110);
                const y = 140 - barHeight;

                return (
                  <g key={index}>
                    {/* Count label above bar */}
                    <text
                      x={x + barWidth / 2}
                      y={y - 6}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="11"
                      fontFamily="var(--font-mono)"
                    >
                      {item.count}
                    </text>

                    {/* Bar rectangle */}
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="4"
                      fill={index >= 3 ? "var(--color-success)" : index === 2 ? "var(--color-primary)" : "var(--color-warning)"}
                      opacity="0.85"
                    />

                    {/* X-axis label */}
                    <text
                      x={x + barWidth / 2}
                      y="160"
                      textAnchor="middle"
                      fill="var(--color-text-muted)"
                      fontSize="11"
                      fontWeight="600"
                    >
                      {item.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Monitoring Interruption Summary */}
        <div className="card">
          <div className="card-title">
            <span>Total Desktop Monitoring Interruption Summary</span>
          </div>
          <p style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "16px" }}>
            Cumulative desktop activity state transitions recorded across all stored examinations.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="diag-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ fontSize: "14px", color: "#ffffff" }}>Focus Departures</strong>
                <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>Candidate switched away from exam window</div>
              </div>
              <span className="badge" style={{ fontSize: "13px", padding: "4px 12px", backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
                {analytics.totalFocusDepartures} departures
              </span>
            </div>

            <div className="diag-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ fontSize: "14px", color: "#ffffff" }}>Fullscreen Exits</strong>
                <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>Candidate exited designated fullscreen workspace</div>
              </div>
              <span className="badge" style={{ fontSize: "13px", padding: "4px 12px", backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#f87171" }}>
                {analytics.totalFullscreenExits} exits
              </span>
            </div>

            <div className="diag-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ fontSize: "14px", color: "#ffffff" }}>System Inactivity Alerts</strong>
                <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>No keyboard/mouse activity exceeding threshold</div>
              </div>
              <span className="badge" style={{ fontSize: "13px", padding: "4px 12px", backgroundColor: "rgba(59, 130, 246, 0.15)", color: "#60a5fa" }}>
                {analytics.totalIdleEvents} alerts
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Attempts Table */}
      <div className="card table-card" style={{ marginTop: "24px" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
          <h4 style={{ fontSize: "15px", fontWeight: "700" }}>Recent Submissions Sample</h4>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Exam Title</th>
              <th>Score</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            {analytics.recentAttempts.map((item) => (
              <tr key={item.id}>
                <td style={{ fontWeight: "600", color: "#ffffff" }}>{item.candidateName}</td>
                <td>{item.examTitle}</td>
                <td style={{ fontFamily: "var(--font-mono)" }}>{item.score} / {item.totalQuestions}</td>
                <td>
                  <span
                    className="badge"
                    style={{
                      fontSize: "10px",
                      backgroundColor: item.percentage >= 60 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: item.percentage >= 60 ? "#34d399" : "#f87171"
                    }}
                  >
                    {item.percentage}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
