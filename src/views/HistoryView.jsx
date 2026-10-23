// src/views/HistoryView.jsx
// Displays historical examination attempts stored locally on this workstation.

import React, { useState, useEffect } from "react";

export default function HistoryView({ onViewReport, isExaminerView = false }) {
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setIsLoading(true);
    setError("");
    try {
      const list = await window.examTrace.getExamHistory();
      setHistory(list || []);
    } catch (err) {
      setError(err.message || "Failed to load examination history.");
    } finally {
      setIsLoading(false);
    }
  }

  function formatDate(isoString) {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) +
        " at " +
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (_) {
      return isoString;
    }
  }

  const filteredHistory = history.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchTitle = (item.examTitle || "").toLowerCase().includes(q);
    const matchCandidate = (item.candidateName || "").toLowerCase().includes(q);
    const matchSubject = (item.subject || "").toLowerCase().includes(q);
    return matchTitle || matchCandidate || matchSubject;
  });

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h2>{isExaminerView ? "Examination Attempt Records" : "My Examination History"}</h2>
          <p className="subtitle">
            Historical examination scores, answer sheets, and desktop monitoring timelines saved on this device.
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadHistory} disabled={isLoading}>
          ↻ Refresh History
        </button>
      </div>

      {/* Local Storage Notice */}
      <div className="info-banner" style={{ marginBottom: "16px" }}>
        <div className="info-banner-icon">💻</div>
        <div className="info-banner-text">
          <h3 style={{ fontSize: "13px" }}>Shared Local Device Storage</h3>
          <p style={{ fontSize: "12px" }}>
            Candidate display names are self-reported identifiers. Because ExamTrace operates offline without cloud accounts,
            this history table reflects all attempts completed on this workstation.
          </p>
        </div>
      </div>

      {error && <div className="error-alert" style={{ marginBottom: "16px" }}>{error}</div>}

      {/* Search Filter */}
      {history.length > 0 && (
        <div style={{ marginBottom: "16px", maxWidth: "380px" }}>
          <input
            type="text"
            className="input-field"
            placeholder="Search by exam, subject, or candidate..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {isLoading ? (
        <div className="loading-placeholder">Loading attempt history...</div>
      ) : history.length === 0 ? (
        <div className="card empty-state">
          <h4>No Examination Attempts Yet</h4>
          <p>You have not completed any examinations yet. Launch an exam from the Dashboard to record your first score.</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="card empty-state">
          <h4>No Matching Attempts Found</h4>
          <p>No examination records matched your search query "{searchQuery}".</p>
        </div>
      ) : (
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Examination</th>
                <th>Date & Time</th>
                <th>Score</th>
                <th>Submission</th>
                <th style={{ textAlign: "right" }}>Report</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((item) => {
                const isPassing = item.percentage >= 60;
                const isAuto = item.submissionType === "auto_submitted";

                return (
                  <tr key={item.id}>
                    <td>
                      <strong style={{ color: "#ffffff" }}>{item.candidateName}</strong>
                    </td>
                    <td>
                      <div>{item.examTitle}</div>
                      <span className="exam-subject-badge" style={{ fontSize: "10px", marginTop: "3px", display: "inline-block" }}>
                        {item.subject}
                      </span>
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--color-text-dim)", fontFamily: "var(--font-mono)" }}>
                      {formatDate(item.startedAt)}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontWeight: "700", color: "#ffffff" }}>
                          {item.score} / {item.totalQuestions}
                        </span>
                        <span
                          className="badge"
                          style={{
                            fontSize: "10px",
                            backgroundColor: isPassing ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                            color: isPassing ? "#34d399" : "#f87171"
                          }}
                        >
                          {item.percentage}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          fontSize: "10px",
                          backgroundColor: isAuto ? "rgba(245, 158, 11, 0.15)" : "rgba(59, 130, 246, 0.15)",
                          color: isAuto ? "#fbbf24" : "#60a5fa"
                        }}
                      >
                        {isAuto ? "⏱ Auto Expired" : "✓ Manual"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => onViewReport(item.id)}
                      >
                        View Full Report
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
