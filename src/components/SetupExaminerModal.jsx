// src/components/SetupExaminerModal.jsx
// First-time setup modal allowing the examiner to configure their passcode.

import React, { useState } from "react";

export default function SetupExaminerModal({ isOpen, onSuccess }) {
  const [passcode, setPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  async function handleSetup(e) {
    e.preventDefault();
    setError("");

    if (!passcode || passcode.length < 6) {
      setError("Passcode must be at least 6 characters long.");
      return;
    }

    if (passcode !== confirmPasscode) {
      setError("Passcodes do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await window.examTrace.setupExaminer(passcode);
      if (res && res.success) {
        onSuccess();
      } else {
        setError("Failed to configure passcode.");
      }
    } catch (err) {
      setError(err.message || "Failed to configure passcode.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Examiner First-Time Setup</h3>
        </div>

        <form onSubmit={handleSetup}>
          <div className="modal-body">
            <p className="modal-description">
              Welcome to <strong>ExamTrace</strong>. Before managing examinations, create a secure examiner passcode. Passcodes are hashed with a unique salt using <code>crypto.scrypt</code>.
            </p>

            <div className="form-group">
              <label>Create Passcode (min 6 characters)</label>
              <input
                type="password"
                className="input-field"
                placeholder="Enter new passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Confirm Passcode</label>
              <input
                type="password"
                className="input-field"
                placeholder="Confirm new passcode"
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {error && <div className="error-alert">{error}</div>}
          </div>

          <div className="modal-footer">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{ width: "100%" }}
            >
              {isLoading ? "Saving Passcode..." : "Complete Setup"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
