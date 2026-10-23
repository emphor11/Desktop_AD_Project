// src/views/ManageExams.jsx
// Table and management controls for viewing, editing, and deleting saved exams.

import React, { useState, useEffect } from "react";

export default function ManageExams({ onEditExam, onCreateNew }) {
  const [exams, setExams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Confirmation modal state for deletion
  const [deletingExam, setDeletingExam] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  async function confirmDelete() {
    if (!deletingExam) return;

    setIsDeleting(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await window.examTrace.deleteExam(deletingExam.id);
      if (res && res.success) {
        setSuccessMsg(`Exam '${deletingExam.title}' deleted successfully.`);
        setDeletingExam(null);
        await loadExams();
        setTimeout(() => setSuccessMsg(""), 4000);
      }
    } catch (err) {
      setError(err.message || "Failed to delete examination.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h2>Manage Examinations</h2>
          <p className="subtitle">View, edit questions, or safely remove examinations.</p>
        </div>
        <button className="btn btn-primary" onClick={onCreateNew}>
          + Create Examination
        </button>
      </div>

      {error && <div className="error-alert" style={{ marginBottom: "16px" }}>{error}</div>}
      {successMsg && <div className="success-alert" style={{ marginBottom: "16px" }}>{successMsg}</div>}

      {isLoading ? (
        <div className="loading-placeholder">Loading examinations...</div>
      ) : exams.length === 0 ? (
        <div className="empty-state card">
          <h4>No Examinations Found</h4>
          <p>There are no saved examinations in local storage. Create your first exam to begin.</p>
          <button className="btn btn-primary" onClick={onCreateNew} style={{ marginTop: "16px" }}>
            + Create New Exam
          </button>
        </div>
      ) : (
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Subject</th>
                <th>Duration</th>
                <th>Questions</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam.id}>
                  <td>
                    <div style={{ fontWeight: "600", color: "var(--color-text-main)" }}>
                      {exam.title}
                    </div>
                    {exam.isSample && (
                      <span className="badge badge-candidate" style={{ fontSize: "10px", marginTop: "4px" }}>
                        Built-in Sample
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="badge" style={{ backgroundColor: "rgba(148, 163, 184, 0.1)", color: "#cbd5e1" }}>
                      {exam.subject || "General"}
                    </span>
                  </td>
                  <td>⏱ {exam.durationMinutes} mins</td>
                  <td>📝 {exam.questions ? exam.questions.length : exam.questionCount || 0} MCQs</td>
                  <td>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => onEditExam(exam.id)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger-subtle"
                        onClick={() => setDeletingExam(exam)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingExam && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Delete Examination?</h3>
              <button
                className="close-btn"
                onClick={() => setDeletingExam(null)}
                disabled={isDeleting}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: "14px", color: "var(--color-text-main)", marginBottom: "8px" }}>
                Are you sure you want to delete <strong>{deletingExam.title}</strong>?
              </p>
              <p style={{ fontSize: "12px", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                This action will remove the examination definition from future exam lists. Any previous attempt records or reports associated with this exam will be safely preserved.
              </p>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setDeletingExam(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
