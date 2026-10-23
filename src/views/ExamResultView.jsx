// src/views/ExamResultView.jsx
// Results, Answer Review, and Desktop Activity Monitoring Timeline
// rendered immediately after examination submission.

import React, { useState } from "react";

export default function ExamResultView({ result, onReturnDashboard }) {
  const [activeTab, setActiveTab] = useState("answers"); // 'answers' or 'monitoring'

  if (!result) return null;

  // Format time used
  const totalSecondsUsed = Math.floor((result.timeUsedMs || 0) / 1000);
  const minutesUsed = Math.floor(totalSecondsUsed / 60);
  const secondsUsed = totalSecondsUsed % 60;
  const timeUsedFormatted = `${minutesUsed}m ${secondsUsed}s`;

  const summary = result.monitoringSummary || {
    focusDeparturesCount: 0,
    fullscreenExitsCount: 0,
    idleEventsCount: 0,
    totalUnfocusedTimeSeconds: 0,
    totalIdleTimeSeconds: 0,
    totalEventsCount: 0
  };

  const events = result.monitoringEvents || [];

  function formatTimeOfDay(isoString) {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch (_) {
      return isoString;
    }
  }

  return (
    <div className="view-container">
      {/* Result Hero Header */}
      <div className="card dashboard-hero" style={{ borderLeft: "4px solid var(--color-primary)" }}>
        <div>
          <span className="exam-subject-badge">{result.subject}</span>
          <h2 style={{ fontSize: "22px", marginTop: "8px" }}>{result.examTitle} — Result</h2>
          <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: "4px" }}>
            Candidate: <strong>{result.candidateName}</strong> | Submission:{" "}
            <span style={{ textTransform: "capitalize", color: result.submissionType === "auto_submitted" ? "#f59e0b" : "#34d399" }}>
              {result.submissionType.replace("_", " ")}
            </span>
          </p>
        </div>

        <button className="btn btn-primary" onClick={onReturnDashboard}>
          Return to Dashboard
        </button>
      </div>

      {/* Primary Score Row */}
      <div className="stats-row" style={{ marginTop: "20px" }}>
        <div className="stat-card" style={{ borderColor: "rgba(59, 130, 246, 0.4)" }}>
          <div className="stat-value" style={{ color: "var(--color-primary)" }}>
            {result.score} / {result.totalQuestions}
          </div>
          <div className="stat-label">Total Score</div>
        </div>

        <div className="stat-card" style={{ borderColor: result.percentage >= 60 ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)" }}>
          <div className="stat-value" style={{ color: result.percentage >= 60 ? "#34d399" : "#f87171" }}>
            {result.percentage}%
          </div>
          <div className="stat-label">Percentage</div>
        </div>

        <div className="stat-card">
          <div className="stat-value" style={{ color: "#34d399" }}>{result.correctCount}</div>
          <div className="stat-label">Correct Answers</div>
        </div>

        <div className="stat-card">
          <div className="stat-value" style={{ color: "#f87171" }}>{result.incorrectCount}</div>
          <div className="stat-label">Incorrect Answers</div>
        </div>

        <div className="stat-card">
          <div className="stat-value" style={{ color: "#94a3b8" }}>{result.unansweredCount}</div>
          <div className="stat-label">Unanswered</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{timeUsedFormatted}</div>
          <div className="stat-label">Time Elapsed</div>
        </div>
      </div>

      {/* Navigation Tab Header between Answers and Activity Monitoring */}
      <div className="tab-pill-container" style={{ marginTop: "24px" }}>
        <button
          className={`tab-pill ${activeTab === "answers" ? "active" : ""}`}
          onClick={() => setActiveTab("answers")}
        >
          📝 Answer Review ({result.totalQuestions})
        </button>
        <button
          className={`tab-pill ${activeTab === "monitoring" ? "active" : ""}`}
          onClick={() => setActiveTab("monitoring")}
        >
          🛡️ Desktop Activity Report ({events.length} events)
        </button>
      </div>

      {/* TAB 1: Answer Key & Explanations Review */}
      {activeTab === "answers" && (
        <section style={{ marginTop: "20px" }}>
          <div className="section-header" style={{ marginBottom: "16px" }}>
            <h3>Question & Answer Review</h3>
            <p className="subtitle">
              Answer keys and explanations were securely calculated by Electron Main and released only after submission.
            </p>
          </div>

          <div className="questions-list">
            {result.answerReview && result.answerReview.map((item, idx) => (
              <div
                key={item.questionId || idx}
                className="card question-card"
                style={{
                  borderLeft: `4px solid ${
                    item.selectedAnswer === null
                      ? "var(--color-border)"
                      : item.isCorrect
                      ? "var(--color-success)"
                      : "var(--color-danger)"
                  }`
                }}
              >
                <div className="question-card-header">
                  <span className="question-number">Question {idx + 1}</span>

                  <div>
                    {item.selectedAnswer === null ? (
                      <span className="badge" style={{ backgroundColor: "rgba(148, 163, 184, 0.15)", color: "#cbd5e1" }}>
                        Not Answered
                      </span>
                    ) : item.isCorrect ? (
                      <span className="badge badge-success">✓ Correct (+1)</span>
                    ) : (
                      <span className="badge" style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#f87171" }}>
                        ✕ Incorrect (0)
                      </span>
                    )}
                  </div>
                </div>

                {/* Statement */}
                <div style={{ fontSize: "14px", fontWeight: "600", margin: "14px 0", color: "#ffffff" }}>
                  {item.text}
                </div>

                {/* Options */}
                <div className="options-stack">
                  {item.options.map((optText, optIdx) => {
                    const isCandidateSelected = item.selectedAnswer === optIdx;
                    const isCorrectAnswer = item.correctAnswer === optIdx;

                    let cardClass = "option-card option-readonly";
                    if (isCorrectAnswer) {
                      cardClass += " option-correct-highlight";
                    } else if (isCandidateSelected && !item.isCorrect) {
                      cardClass += " option-incorrect-highlight";
                    }

                    return (
                      <div key={optIdx} className={cardClass}>
                        <span className="option-letter">{String.fromCharCode(65 + optIdx)}.</span>
                        <span className="option-text" style={{ flex: 1 }}>{optText}</span>

                        {isCandidateSelected && (
                          <span className="badge" style={{ fontSize: "10px", backgroundColor: item.isCorrect ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)" }}>
                            Your Choice
                          </span>
                        )}

                        {isCorrectAnswer && (
                          <span className="badge badge-success" style={{ fontSize: "10px" }}>
                            Correct Option
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {item.explanation && (
                  <div style={{ marginTop: "14px", padding: "10px 14px", backgroundColor: "rgba(15, 23, 42, 0.4)", borderRadius: "6px", border: "1px solid var(--color-border-subtle)", fontSize: "12px", color: "var(--color-text-muted)" }}>
                    <strong style={{ color: "var(--color-primary)" }}>Explanation: </strong>
                    {item.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 2: Desktop Activity Monitoring Report */}
      {activeTab === "monitoring" && (
        <section style={{ marginTop: "20px" }}>
          {/* Monitoring Metrics Overview Cards */}
          <div className="stats-row" style={{ marginBottom: "20px" }}>
            <div className="stat-card">
              <div className="stat-value" style={{ color: summary.focusDeparturesCount > 0 ? "#f59e0b" : "#34d399" }}>
                {summary.focusDeparturesCount}
              </div>
              <div className="stat-label">Focus Departures (Blur)</div>
            </div>

            <div className="stat-card">
              <div className="stat-value" style={{ color: summary.totalUnfocusedTimeSeconds > 0 ? "#f59e0b" : "#34d399" }}>
                {summary.totalUnfocusedTimeSeconds}s
              </div>
              <div className="stat-label">Time Outside Window</div>
            </div>

            <div className="stat-card">
              <div className="stat-value" style={{ color: summary.fullscreenExitsCount > 0 ? "#f59e0b" : "#34d399" }}>
                {summary.fullscreenExitsCount}
              </div>
              <div className="stat-label">Fullscreen Exits</div>
            </div>

            <div className="stat-card">
              <div className="stat-value" style={{ color: summary.idleEventsCount > 0 ? "#f59e0b" : "#34d399" }}>
                {summary.idleEventsCount}
              </div>
              <div className="stat-label">Inactivity Alerts</div>
            </div>

            <div className="stat-card">
              <div className="stat-value">{summary.totalIdleTimeSeconds}s</div>
              <div className="stat-label">Total Inactive Duration</div>
            </div>
          </div>

          {/* Academic Integrity Notice */}
          <div className="info-banner" style={{ marginBottom: "20px" }}>
            <div className="info-banner-icon">ℹ️</div>
            <div className="info-banner-text">
              <h3 style={{ fontSize: "13px" }}>Objective Activity Observation</h3>
              <p style={{ fontSize: "12px" }}>
                ExamTrace records desktop window state changes, minimize actions, fullscreen toggles, and system idle times for instructor evaluation.
                Recorded events provide contextual awareness and do not constitute automated cheating determination.
              </p>
            </div>
          </div>

          {/* Chronological Event Timeline */}
          <div className="card table-card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4 style={{ fontSize: "15px", fontWeight: "700" }}>Chronological Activity Timeline</h4>
              <span style={{ fontSize: "12px", color: "var(--color-text-dim)" }}>
                {events.length} recorded events
              </span>
            </div>

            {events.length === 0 ? (
              <div className="empty-state">
                <p>No activity events were recorded during this attempt.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: "110px" }}>Time</th>
                    <th style={{ width: "180px" }}>Event Type</th>
                    <th>Reason / Details</th>
                    <th style={{ width: "160px" }}>Duration Away</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((evt) => {
                    const isInterruption = evt.type === "WINDOW_BLUR" || evt.type === "FULLSCREEN_EXIT" || evt.type === "SYSTEM_IDLE" || evt.type === "WINDOW_MINIMIZED";
                    const isReturn = evt.type === "WINDOW_FOCUS" || evt.type === "SYSTEM_ACTIVE" || evt.type === "FULLSCREEN_ENTER";

                    return (
                      <tr key={evt.id}>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#cbd5e1" }}>
                          {formatTimeOfDay(evt.timestamp)}
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              fontSize: "11px",
                              backgroundColor: isInterruption
                                ? "rgba(245, 158, 11, 0.15)"
                                : isReturn
                                ? "rgba(16, 185, 129, 0.15)"
                                : "rgba(59, 130, 246, 0.15)",
                              color: isInterruption ? "#fbbf24" : isReturn ? "#34d399" : "#60a5fa"
                            }}
                          >
                            {evt.type}
                          </span>
                        </td>
                        <td style={{ color: "var(--color-text-main)", fontSize: "13px" }}>
                          {evt.reason}
                        </td>
                        <td style={{ fontSize: "12px", color: "var(--color-text-dim)", fontFamily: "var(--font-mono)" }}>
                          {evt.metadata && evt.metadata.durationAwaySeconds !== undefined
                            ? `${evt.metadata.durationAwaySeconds}s away`
                            : evt.metadata && evt.metadata.idleDurationSeconds !== undefined
                            ? `${evt.metadata.idleDurationSeconds}s idle`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      <div style={{ textAlign: "center", marginTop: "32px", paddingBottom: "24px" }}>
        <button className="btn btn-primary" onClick={onReturnDashboard}>
          Back to Examination Dashboard
        </button>
      </div>
    </div>
  );
}
