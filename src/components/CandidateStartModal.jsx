// src/components/CandidateStartModal.jsx
// Pre-examination modal: collects candidate display name, presents exam rules,
// and shows transparent monitoring disclosure.

import React, { useState } from "react";

export default function CandidateStartModal({ exam, isOpen, onClose, onStart }) {
  const [candidateName, setCandidateName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !exam) return null;

  async function handleConfirm(e) {
    e.preventDefault();
    const trimmed = candidateName.trim();

    if (!trimmed) {
      setError("Please enter your display name to start the examination.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await onStart(exam.id, trimmed);
    } catch (err) {
      setError(err.message || "Failed to start examination.");
      setIsLoading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ maxWidth: "520px" }}>
        <div className="modal-header">
          <h3>Start Examination</h3>
          <button className="close-btn" onClick={onClose} disabled={isLoading}>
            ✕
          </button>
        </div>

        <form onSubmit={handleConfirm}>
          <div className="modal-body">
            {/* Exam Highlights */}
            <div style={{ backgroundColor: "rgba(15, 23, 42, 0.5)", padding: "16px", borderRadius: "8px", border: "1px solid var(--color-border)", marginBottom: "16px" }}>
              <h4 style={{ fontSize: "16px", color: "#ffffff", marginBottom: "4px" }}>{exam.title}</h4>
              <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "var(--color-text-muted)" }}>
                <span>📚 {exam.subject}</span>
                <span>⏱ {exam.durationMinutes} Minutes</span>
                <span>📝 {exam.questionCount} Questions</span>
              </div>
            </div>

            {/* Candidate Name Input */}
            <div className="form-group">
              <label>Candidate Display Name *</label>
              <input
                type="text"
                className="input-field"
                placeholder="Enter your full name"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                autoFocus
                disabled={isLoading}
              />
              <span style={{ fontSize: "11px", color: "var(--color-text-dim)", marginTop: "4px" }}>
                Self-reported identifier for this device's local result reports (not authenticated cloud accounts).
              </span>
            </div>

            {/* Honest Monitoring Disclosure */}
            <div className="info-banner" style={{ marginTop: "16px" }}>
              <div className="info-banner-icon">🛡️</div>
              <div className="info-banner-text">
                <h3 style={{ fontSize: "13px" }}>Desktop Monitoring Disclosure</h3>
                <p style={{ fontSize: "12px" }}>
                  During this examination, ExamTrace monitors window focus, window minimize events,
                  fullscreen state, and system idle time. Please remain in the examination workspace until submission.
                </p>
              </div>
            </div>

            {error && <div className="error-alert" style={{ marginTop: "14px" }}>{error}</div>}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? "Starting..." : "Begin Examination"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
