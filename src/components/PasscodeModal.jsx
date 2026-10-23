// src/components/PasscodeModal.jsx
// In-app modal for entering examiner passcode to unlock Examiner Mode.

import React, { useState } from "react";

export default function PasscodeModal({ isOpen, onClose, onSuccess }) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  async function handleUnlock(e) {
    e.preventDefault();
    if (!passcode.trim()) {
      setError("Please enter your examiner passcode.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await window.examTrace.unlockExaminer(passcode);
      if (res && res.success) {
        setPasscode("");
        onSuccess();
      } else {
        setError("Failed to unlock Examiner Mode.");
      }
    } catch (err) {
      setError(err.message || "Invalid passcode.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Unlock Examiner Mode</h3>
          <button className="close-btn" onClick={onClose} disabled={isLoading}>
            ✕
          </button>
        </div>

        <form onSubmit={handleUnlock}>
          <div className="modal-body">
            <p className="modal-description">
              Enter your examiner passcode to manage examinations, access answer keys, and configure monitoring settings.
            </p>

            <div className="form-group">
              <label>Examiner Passcode</label>
              <input
                type="password"
                className="input-field"
                placeholder="Enter passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoFocus
                disabled={isLoading}
              />
            </div>

            {error && <div className="error-alert">{error}</div>}
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
              {isLoading ? "Verifying..." : "Unlock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
