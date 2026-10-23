// src/views/ExamWorkspace.jsx
// Distraction-free, timed examination workspace with authoritative countdown timer,
// question palette, answer selection, review marking, in-app submission modal,
// and real-time desktop activity monitoring indicators.

import React, { useState, useEffect } from "react";

export default function ExamWorkspace({ activeExam, onExamSubmitted }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState(activeExam?.answers || {});
  const [markedForReview, setMarkedForReview] = useState(activeExam?.markedForReview || []);
  const [timerText, setTimerText] = useState("00:00:00");
  const [remainingSeconds, setRemainingSeconds] = useState(180);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Phase 4: Monitoring State
  const [recentEvent, setRecentEvent] = useState(null);
  const [eventCount, setEventCount] = useState(1); // includes EXAM_STARTED
  const [fullscreenWarning, setFullscreenWarning] = useState("");
  const [isDemoMode, setIsDemoMode] = useState(false);

  const questions = activeExam?.questions || [];
  const currentQuestion = questions[currentIdx] || null;

  // Initialize monitoring status & subscribe to real-time events
  useEffect(() => {
    // Check initial demo mode
    async function initMonitoringState() {
      try {
        const demo = await window.examTrace.getMonitoringDemoMode();
        setIsDemoMode(demo);
      } catch (_) {}
    }
    initMonitoringState();

    // 1. Authoritative timer ticks from Main
    const unsubscribeTimer = window.examTrace.onTimerUpdate((tick) => {
      setTimerText(tick.formattedTime);
      setRemainingSeconds(tick.remainingSeconds);
    });

    // 2. Exam completed broadcast (e.g. timeout auto-submit)
    const unsubscribeCompleted = window.examTrace.onExamCompleted((result) => {
      onExamSubmitted(result);
    });

    // 3. Real-time monitoring activity events
    const unsubscribeMonitoring = window.examTrace.onMonitoringEvent((event) => {
      setRecentEvent(event);
      setEventCount((prev) => prev + 1);

      // Clear event toast after 4 seconds
      setTimeout(() => {
        setRecentEvent((current) => (current && current.id === event.id ? null : current));
      }, 4000);
    });

    // 4. Fullscreen exit warning
    const unsubscribeFullscreen = window.examTrace.onFullscreenWarning((data) => {
      setFullscreenWarning(data.message || "Fullscreen exit detected. Please return to fullscreen.");
    });

    return () => {
      unsubscribeTimer();
      unsubscribeCompleted();
      unsubscribeMonitoring();
      unsubscribeFullscreen();
    };
  }, [onExamSubmitted]);

  // Handle Demo Mode toggle (10s idle threshold vs 60s)
  async function handleToggleDemoMode() {
    try {
      const next = !isDemoMode;
      await window.examTrace.setMonitoringDemoMode(next);
      setIsDemoMode(next);
    } catch (err) {
      console.error("Failed to toggle Demo Mode:", err);
    }
  }

  // Handle Return to Fullscreen
  async function handleEnterFullscreen() {
    try {
      await window.examTrace.setFullScreen(true);
      setFullscreenWarning("");
    } catch (err) {
      console.error("Failed to enter fullscreen:", err);
    }
  }

  // Handle option selection
  async function handleSelectOption(optIndex) {
    if (!currentQuestion) return;

    const qId = currentQuestion.id;
    const newAnswer = answers[qId] === optIndex ? null : optIndex;

    const nextAnswers = { ...answers };
    if (newAnswer !== null) {
      nextAnswers[qId] = newAnswer;
    } else {
      delete nextAnswers[qId];
    }
    setAnswers(nextAnswers);

    try {
      await window.examTrace.saveAnswer(qId, newAnswer);
    } catch (err) {
      console.error("Failed to save answer in Main:", err);
      setErrorMsg(err.message || "Failed to record answer.");
    }
  }

  // Handle Mark for Review toggle
  async function handleToggleReview() {
    if (!currentQuestion) return;

    const qId = currentQuestion.id;
    const isCurrentlyMarked = markedForReview.includes(qId);
    const newMarkedState = !isCurrentlyMarked;

    let nextMarked;
    if (newMarkedState) {
      nextMarked = [...markedForReview, qId];
    } else {
      nextMarked = markedForReview.filter((id) => id !== qId);
    }
    setMarkedForReview(nextMarked);

    try {
      await window.examTrace.markForReview(qId, newMarkedState);
    } catch (err) {
      console.error("Failed to update review status in Main:", err);
    }
  }

  // Handle manual submission confirmation
  async function handleConfirmSubmit() {
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const result = await window.examTrace.submitExam();
      setIsSubmitModalOpen(false);
      onExamSubmitted(result);
    } catch (err) {
      setErrorMsg(err.message || "Submission failed.");
      setIsSubmitting(false);
    }
  }

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const reviewCount = markedForReview.length;
  const isLowTime = remainingSeconds <= 60 && remainingSeconds > 0;

  return (
    <div className="exam-workspace-container">
      {/* Top Workspace Header */}
      <header className="workspace-topbar">
        <div className="workspace-brand">
          <span className="exam-pill">EXAMTRACE WORKSPACE</span>
          <h2 className="workspace-title">{activeExam?.title}</h2>
          <span className="candidate-pill">Candidate: {activeExam?.candidateName}</span>
        </div>

        {/* Authoritative Timer */}
        <div className={`countdown-timer ${isLowTime ? "timer-danger" : ""}`}>
          <span className="timer-icon">⏱</span>
          <span className="timer-display">{timerText}</span>
          {isLowTime && <span className="low-time-label">ENDING SOON</span>}
        </div>

        <div className="workspace-actions">
          {/* Demo Mode Toggle Button (10s inactivity) */}
          <button
            className={`btn btn-sm ${isDemoMode ? "btn-warning" : "btn-secondary"}`}
            onClick={handleToggleDemoMode}
            title="Toggles 10s idle threshold for live viva demonstration"
          >
            {isDemoMode ? "⚡ Demo Mode: 10s Idle" : "Demo Mode: Off"}
          </button>

          {/* Monitoring State Badge */}
          <span className="monitored-badge" title="Monitors focus, minimize, fullscreen, and idle time">
            ● Active Monitoring ({eventCount})
          </span>

          <button
            className="btn btn-primary"
            onClick={() => setIsSubmitModalOpen(true)}
            disabled={isSubmitting}
          >
            Submit Examination
          </button>
        </div>
      </header>

      {/* Fullscreen Exit Warning Banner */}
      {fullscreenWarning && (
        <div className="fullscreen-warning-banner">
          <span>⚠️ {fullscreenWarning}</span>
          <button className="btn btn-sm btn-warning" onClick={handleEnterFullscreen}>
            Return to Fullscreen
          </button>
        </div>
      )}

      {/* Live Monitoring Toast */}
      {recentEvent && (
        <div className="monitoring-live-toast">
          <span className="toast-dot" />
          <span className="toast-type">[{recentEvent.type}]:</span>
          <span className="toast-reason">{recentEvent.reason}</span>
        </div>
      )}

      {errorMsg && (
        <div className="error-alert" style={{ margin: "12px 24px 0" }}>
          {errorMsg}
        </div>
      )}

      {/* Main Examination Body */}
      <div className="workspace-content">
        {/* Question Area */}
        <main className="question-workspace">
          {currentQuestion ? (
            <div className="question-box">
              <div className="question-box-header">
                <span className="question-seq">
                  Question {currentIdx + 1} of {questions.length}
                </span>

                <div style={{ display: "flex", gap: "8px" }}>
                  {markedForReview.includes(currentQuestion.id) && (
                    <span className="badge badge-examiner">Marked for Review</span>
                  )}
                  {answers[currentQuestion.id] !== undefined && (
                    <span className="badge badge-success">Answered</span>
                  )}
                </div>
              </div>

              {/* Statement */}
              <div className="question-statement">{currentQuestion.text}</div>

              {/* Options Cards */}
              <div className="options-stack">
                {currentQuestion.options.map((optText, optIdx) => {
                  const isSelected = answers[currentQuestion.id] === optIdx;
                  return (
                    <div
                      key={optIdx}
                      className={`option-card ${isSelected ? "option-selected" : ""}`}
                      onClick={() => handleSelectOption(optIdx)}
                    >
                      <div className={`radio-circle ${isSelected ? "radio-checked" : ""}`}>
                        {isSelected && <div className="radio-inner" />}
                      </div>
                      <span className="option-letter">
                        {String.fromCharCode(65 + optIdx)}.
                      </span>
                      <span className="option-text">{optText}</span>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Nav Buttons */}
              <div className="question-nav-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
                  disabled={currentIdx === 0}
                >
                  ← Previous
                </button>

                <button
                  type="button"
                  className={`btn ${markedForReview.includes(currentQuestion.id) ? "btn-warning" : "btn-secondary"}`}
                  onClick={handleToggleReview}
                >
                  {markedForReview.includes(currentQuestion.id)
                    ? "★ Unmark Review"
                    : "☆ Mark for Review"}
                </button>

                {currentIdx < questions.length - 1 ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setIsSubmitModalOpen(true)}
                  >
                    Review & Submit
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="loading-placeholder">Loading question...</div>
          )}
        </main>

        {/* Right-Hand Question Palette */}
        <aside className="question-palette-sidebar">
          <div className="palette-header">
            <h4>Question Palette</h4>
            <span style={{ fontSize: "11px", color: "var(--color-text-dim)" }}>
              {answeredCount}/{questions.length} Answered
            </span>
          </div>

          <div className="palette-grid">
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined;
              const isMarked = markedForReview.includes(q.id);
              const isCurrent = idx === currentIdx;

              let btnClass = "palette-btn";
              if (isCurrent) btnClass += " current";
              if (isAnswered) btnClass += " answered";
              if (isMarked) btnClass += " marked";

              return (
                <button
                  key={q.id}
                  className={btnClass}
                  onClick={() => setCurrentIdx(idx)}
                  title={`Question ${idx + 1}${isAnswered ? " (Answered)" : ""}${isMarked ? " (Marked for Review)" : ""}`}
                >
                  {idx + 1}
                  {isMarked && <span className="marked-dot" />}
                </button>
              );
            })}
          </div>

          {/* Palette Legend */}
          <div className="palette-legend">
            <div className="legend-item">
              <span className="legend-indicator answered" />
              <span>Answered ({answeredCount})</span>
            </div>
            <div className="legend-item">
              <span className="legend-indicator unanswered" />
              <span>Unanswered ({unansweredCount})</span>
            </div>
            <div className="legend-item">
              <span className="legend-indicator marked" />
              <span>Marked for Review ({reviewCount})</span>
            </div>
          </div>
        </aside>
      </div>

      {/* In-App Submission Modal */}
      {isSubmitModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Submit Examination?</h3>
              <button
                className="close-btn"
                onClick={() => setIsSubmitModalOpen(false)}
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-description">
                Are you ready to finalize and submit your examination? Once submitted, your answers cannot be altered.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", margin: "16px 0" }}>
                <div className="diag-item">
                  <div className="diag-label">Answered</div>
                  <div className="diag-value" style={{ color: "#34d399" }}>
                    {answeredCount} / {questions.length}
                  </div>
                </div>

                <div className="diag-item">
                  <div className="diag-label">Unanswered</div>
                  <div className="diag-value" style={{ color: unansweredCount > 0 ? "#f87171" : "#94a3b8" }}>
                    {unansweredCount}
                  </div>
                </div>

                <div className="diag-item" style={{ gridColumn: "1 / -1" }}>
                  <div className="diag-label">Marked for Review</div>
                  <div className="diag-value" style={{ color: "#f59e0b" }}>
                    {reviewCount} question(s) flagged
                  </div>
                </div>
              </div>

              {unansweredCount > 0 && (
                <div className="error-alert" style={{ fontSize: "12px" }}>
                  ⚠️ You still have {unansweredCount} unanswered question(s).
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsSubmitModalOpen(false)}
                disabled={isSubmitting}
              >
                Return to Exam
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Grading..." : "Confirm & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
