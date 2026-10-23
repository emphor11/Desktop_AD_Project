// src/views/ExaminerDashboard.jsx
// Overview dashboard for examiners with quick management shortcuts and metrics.

import React, { useState, useEffect } from "react";

export default function ExaminerDashboard({ onNavigate, onLock }) {
  const [examCount, setExamCount] = useState(0);
  const [sampleExamPresent, setSampleExamPresent] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const exams = await window.examTrace.getAvailableExams();
        setExamCount(exams.length);
        const hasSample = exams.some((e) => e.id === "sample-cs-fundamentals");
        setSampleExamPresent(hasSample);
      } catch (err) {
        console.error("Failed to load examiner stats:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="view-container">
      <div className="card dashboard-hero examiner-hero">
        <div className="hero-text">
          <h2>Examiner Control Center</h2>
          <p>
            You have unlocked Examiner Mode. You can author multiple-choice questions, configure exam durations,
            manage saved examinations, and view candidate history and activity reports.
          </p>
        </div>
        <button className="btn btn-warning" onClick={onLock}>
          <span>🔓</span> Lock Examiner Mode
        </button>
      </div>

      {/* Metrics Row */}
      <div className="stats-row" style={{ marginTop: "24px" }}>
        <div className="stat-card">
          <div className="stat-value">{isLoading ? "..." : examCount}</div>
          <div className="stat-label">Total Examinations</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{sampleExamPresent ? "Ready" : "Deleted"}</div>
          <div className="stat-label">Sample CS Exam</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">Unlocked</div>
          <div className="stat-label">Main Process Auth</div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid-2col" style={{ marginTop: "24px" }}>
        <div className="card action-card">
          <h4>Create New Examination</h4>
          <p>Draft multiple-choice questions, set duration, choose single correct answer options, and save directly to local JSON storage.</p>
          <button className="btn btn-primary" onClick={() => onNavigate("create-exam")} style={{ marginTop: "16px" }}>
            + Author Examination
          </button>
        </div>

        <div className="card action-card">
          <h4>Manage Existing Examinations</h4>
          <p>Review existing examinations, edit question options and explanations, or delete old exams with safety confirmation.</p>
          <button className="btn btn-secondary" onClick={() => onNavigate("manage-exams")} style={{ marginTop: "16px" }}>
            📂 Manage Examinations ({examCount})
          </button>
        </div>
      </div>
    </div>
  );
}
