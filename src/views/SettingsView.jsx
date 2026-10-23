// src/views/SettingsView.jsx
// Application Settings view supporting Theme personalization,
// examiner monitoring threshold configuration, and examiner passcode updates.

import React, { useState, useEffect } from "react";

export default function SettingsView({ isExaminer = false }) {
  const [theme, setTheme] = useState("dark");
  const [defaultDuration, setDefaultDuration] = useState(15);
  const [idleThreshold, setIdleThreshold] = useState(60);
  const [demoMode, setDemoMode] = useState(false);

  // Passcode change state
  const [currentPasscode, setCurrentPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [passcodeMsg, setPasscodeMsg] = useState("");
  const [passcodeError, setPasscodeError] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setIsLoading(true);
    try {
      const s = await window.examTrace.getSettings();
      setTheme(s.theme || "dark");
      setDefaultDuration(s.defaultDurationMinutes || 15);
      setIdleThreshold(s.idleThresholdSeconds || 60);
      setDemoMode(!!s.demoMode);
      applyTheme(s.theme || "dark");
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setIsLoading(false);
    }
  }

  function applyTheme(themeMode) {
    if (themeMode === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
    } else {
      document.documentElement.setAttribute("data-theme", themeMode);
    }
  }

  async function handleThemeChange(newTheme) {
    setTheme(newTheme);
    applyTheme(newTheme);
    try {
      await window.examTrace.saveSettings({ theme: newTheme });
      setSaveMsg("Theme preference updated.");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (err) {
      setSaveError(err.message || "Failed to save theme.");
    }
  }

  async function handleSaveExaminerSettings(e) {
    e.preventDefault();
    setSaveError("");
    setSaveMsg("");

    try {
      await window.examTrace.saveSettings({
        defaultDurationMinutes: Number(defaultDuration),
        idleThresholdSeconds: Number(idleThreshold),
        demoMode
      });
      setSaveMsg("Examiner administration preferences saved.");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (err) {
      setSaveError(err.message || "Failed to save settings.");
    }
  }

  async function handleChangePasscode(e) {
    e.preventDefault();
    setPasscodeError("");
    setPasscodeMsg("");

    if (!currentPasscode) {
      setPasscodeError("Please enter your current passcode.");
      return;
    }

    if (!newPasscode || newPasscode.length < 6) {
      setPasscodeError("New passcode must be at least 6 characters long.");
      return;
    }

    if (newPasscode !== confirmPasscode) {
      setPasscodeError("New passcodes do not match.");
      return;
    }

    try {
      const res = await window.examTrace.changeExaminerPasscode({
        currentPasscode,
        newPasscode
      });
      if (res && res.success) {
        setPasscodeMsg("Examiner passcode changed successfully!");
        setCurrentPasscode("");
        setNewPasscode("");
        setConfirmPasscode("");
        setTimeout(() => setPasscodeMsg(""), 4000);
      }
    } catch (err) {
      setPasscodeError(err.message || "Failed to change passcode.");
    }
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h2>Application Settings</h2>
          <p className="subtitle">Configure desktop appearance, idle thresholds, and examiner security.</p>
        </div>
      </div>

      {saveMsg && <div className="success-alert" style={{ marginBottom: "16px" }}>{saveMsg}</div>}
      {saveError && <div className="error-alert" style={{ marginBottom: "16px" }}>{saveError}</div>}

      {/* SECTION 1: Appearance & Theme */}
      <div className="card form-card">
        <h3 className="form-card-title">Appearance & Workspace Theme</h3>
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "16px" }}>
          Choose your visual appearance preference. Saved locally across application restarts.
        </p>

        <div style={{ display: "flex", gap: "16px" }}>
          <button
            className={`btn ${theme === "dark" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => handleThemeChange("dark")}
            disabled={isLoading}
          >
            🌙 Dark Theme (Academic Navy)
          </button>

          <button
            className={`btn ${theme === "light" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => handleThemeChange("light")}
            disabled={isLoading}
          >
            ☀️ Light Theme (Clean Neutral)
          </button>

          <button
            className={`btn ${theme === "system" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => handleThemeChange("system")}
            disabled={isLoading}
          >
            🖥️ Follow Operating System
          </button>
        </div>
      </div>

      {/* SECTION 2: Examiner Monitoring Administration (Protected) */}
      <div className="card form-card" style={{ marginTop: "20px", opacity: isExaminer ? 1 : 0.7 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 className="form-card-title">Examiner Monitoring Administration</h3>
          {!isExaminer && (
            <span className="badge badge-candidate" style={{ fontSize: "11px" }}>
              🔒 Examiner Mode Required
            </span>
          )}
        </div>

        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "16px" }}>
          Protected parameters enforced in the Electron Main process. Requires Examiner Mode authorization to modify.
        </p>

        <form onSubmit={handleSaveExaminerSettings}>
          <div className="form-row">
            <div className="form-group flex-1">
              <label>Default Examination Duration (Minutes)</label>
              <input
                type="number"
                min="1"
                max="300"
                className="input-field"
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(e.target.value)}
                disabled={!isExaminer || isLoading}
              />
            </div>

            <div className="form-group flex-1">
              <label>Default System Idle Threshold (Seconds)</label>
              <input
                type="number"
                min="5"
                max="300"
                className="input-field"
                value={idleThreshold}
                onChange={(e) => setIdleThreshold(e.target.value)}
                disabled={!isExaminer || isLoading}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "16px", padding: "12px 16px", backgroundColor: "rgba(15, 23, 42, 0.4)", borderRadius: "8px", border: "1px solid var(--color-border-subtle)" }}>
            <input
              type="checkbox"
              id="demoModeToggle"
              style={{ width: "18px", height: "18px", cursor: isExaminer ? "pointer" : "not-allowed" }}
              checked={demoMode}
              onChange={(e) => setDemoMode(e.target.checked)}
              disabled={!isExaminer || isLoading}
            />
            <label htmlFor="demoModeToggle" style={{ fontSize: "13px", cursor: isExaminer ? "pointer" : "default", fontWeight: "600" }}>
              Enable Demonstration Mode (Forces 10-second system inactivity threshold for live viva demonstrations)
            </label>
          </div>

          {isExaminer && (
            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: "16px" }}
              disabled={isLoading}
            >
              Save Examiner Settings
            </button>
          )}
        </form>
      </div>

      {/* SECTION 3: Change Examiner Passcode (Examiner Mode only) */}
      {isExaminer && (
        <div className="card form-card" style={{ marginTop: "20px" }}>
          <h3 className="form-card-title">Change Examiner Passcode</h3>
          <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "16px" }}>
            Re-hashes with a new random 16-byte salt and scrypt key derivation.
          </p>

          {passcodeMsg && <div className="success-alert" style={{ marginBottom: "14px" }}>{passcodeMsg}</div>}
          {passcodeError && <div className="error-alert" style={{ marginBottom: "14px" }}>{passcodeError}</div>}

          <form onSubmit={handleChangePasscode}>
            <div className="form-row">
              <div className="form-group flex-1">
                <label>Current Passcode</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Enter current passcode"
                  value={currentPasscode}
                  onChange={(e) => setCurrentPasscode(e.target.value)}
                />
              </div>

              <div className="form-group flex-1">
                <label>New Passcode (min 6 characters)</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Enter new passcode"
                  value={newPasscode}
                  onChange={(e) => setNewPasscode(e.target.value)}
                />
              </div>

              <div className="form-group flex-1">
                <label>Confirm New Passcode</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Confirm new passcode"
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-warning"
              style={{ marginTop: "16px" }}
            >
              Update Examiner Passcode
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
