// src/views/ExamResultView.jsx
// Results and Answer Review screen rendered immediately after examination submission.

import React from "react";

export default function ExamResultView({ result, onReturnDashboard }) {
  if (!result) return null;

  // Format time used
  const totalSecondsUsed = Math.floor((result.timeUsedMs || 0) / 1000);
  const minutesUsed = Math.floor(totalSecondsUsed / 60);
  const secondsUsed = totalSecondsUsed % 60;
  const timeUsedFormatted = `${minutesUsed}m ${secondsUsed}s`;

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

      {/* Answer Key & Explanations Review */}
      <section style={{ marginTop: "28px" }}>
        <div className="section-header" style={{ marginBottom: "16px" }}>
          <h3>Question & Answer Review</h3>
          <p className="subtitle">
            Answer keys and explanations are securely calculated by the Main process and released only after submission.
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

        <div style={{ textAlign: "center", marginTop: "32px", paddingBottom: "24px" }}>
          <button className="btn btn-primary" onClick={onReturnDashboard}>
            Back to Examination Dashboard
          </button>
        </div>
      </section>
    </div>
  );
}
