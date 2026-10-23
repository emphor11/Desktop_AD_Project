// src/views/CandidateDashboard.jsx
// Main screen for candidates to browse and launch examinations.

import React, { useState, useEffect } from "react";
import CandidateStartModal from "../components/CandidateStartModal.jsx";

export default function CandidateDashboard({ onOpenUnlockModal, onBeginActiveExam }) {
  const [exams, setExams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedExamForStart, setSelectedExamForStart] = useState(null);

  useEffect(() => {
    loadExams();
  }, []);

  async function loadExams() {
    setIsLoading(true);
    setError("");
    try {
      const list = await window.examTrace.getAvailableExams();
      setExams(list || []);
    } catch (err) {
      setError(err.message || "Failed to load examinations.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirmStart(examId, candidateName) {
    const activeData = await window.examTrace.startExam(examId, candidateName);
    setSelectedExamForStart(null);
    onBeginActiveExam(activeData);
  }

  return (
    <div className="view-container">
      {/* Welcome Banner */}
      <div className="card dashboard-hero">
        <div className="hero-text">
          <h2>Welcome, Candidate</h2>
          <p>
            Browse available examinations below. When an examination begins, ExamTrace monitors window focus,
            fullscreen state, and system idle activity in an authoritative timed workspace.
          </p>
        </div>
        <button className="btn btn-outline" onClick={onOpenUnlockModal}>
          <span>🔒</span> Examiner Login
        </button>
      </div>

      {error && <div className="error-alert" style={{ marginTop: "16px" }}>{error}</div>}

      {/* Available Exams Section */}
      <section className="dashboard-section" style={{ marginTop: "24px" }}>
        <div className="section-header">
          <h3>Available Examinations ({exams.length})</h3>
          <button className="btn btn-sm btn-secondary" onClick={loadExams} disabled={isLoading}>
            ↻ Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="loading-placeholder">Loading available examinations...</div>
        ) : exams.length === 0 ? (
          <div className="empty-state">
            <h4>No Examinations Available</h4>
            <p>No exams have been published yet. Ask your examiner to create one in Examiner Mode.</p>
          </div>
        ) : (
          <div className="exam-grid">
            {exams.map((exam) => (
              <div key={exam.id} className="exam-card">
                <div className="exam-card-header">
                  <span className="exam-subject-badge">{exam.subject}</span>
                  <span className="exam-duration-badge">⏱ {exam.durationMinutes} mins</span>
                </div>

                <h4 className="exam-title">{exam.title}</h4>
                <p className="exam-description">
                  {exam.description || "Comprehensive examination covering key course competencies."}
                </p>

                <div className="exam-meta">
                  <span>📝 {exam.questionCount} Questions</span>
                  <span>🎯 Single-Choice MCQ</span>
                </div>

                <div className="exam-card-footer">
                  <button
                    className="btn btn-primary"
                    style={{ width: "100%" }}
                    onClick={() => setSelectedExamForStart(exam)}
                  >
                    Start Examination
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Candidate Start Modal */}
      <CandidateStartModal
        exam={selectedExamForStart}
        isOpen={!!selectedExamForStart}
        onClose={() => setSelectedExamForStart(null)}
        onStart={handleConfirmStart}
      />
    </div>
  );
}
