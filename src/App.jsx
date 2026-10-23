import React, { useState, useEffect } from "react";

export default function App() {
  const [activeMode, setActiveMode] = useState("candidate"); // 'candidate' or 'examiner'
  const [activeTab, setActiveTab] = useState("dashboard");
  const [systemInfo, setSystemInfo] = useState(null);
  const [ipcStatus, setIpcStatus] = useState("connecting"); // 'connecting', 'connected', 'error'
  const [errorMessage, setErrorMessage] = useState("");

  // Phase 1: Test secure IPC communication with Electron Main
  useEffect(() => {
    async function testIpcConnection() {
      try {
        if (!window.examTrace || typeof window.examTrace.ping !== "function") {
          throw new Error("window.examTrace API not found. Preload script may not have loaded.");
        }

        const info = await window.examTrace.ping();
        setSystemInfo(info);
        setIpcStatus("connected");
      } catch (err) {
        console.error("IPC Connection failed:", err);
        setIpcStatus("error");
        setErrorMessage(err.message || "Failed to communicate with Electron Main Process");
      }
    }

    testIpcConnection();
  }, []);

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand-section">
          <div className="brand-icon">ET</div>
          <div className="brand-text">
            <h1>ExamTrace</h1>
            <p>Monitor System</p>
          </div>
        </div>

        <nav className="nav-section">
          {activeMode === "candidate" ? (
            <>
              <button
                className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
                onClick={() => setActiveTab("dashboard")}
              >
                <span>📊</span> Dashboard
              </button>
              <button
                className={`nav-item ${activeTab === "history" ? "active" : ""}`}
                onClick={() => setActiveTab("history")}
              >
                <span>📜</span> My History
              </button>
              <button
                className={`nav-item ${activeTab === "reports" ? "active" : ""}`}
                onClick={() => setActiveTab("reports")}
              >
                <span>📑</span> My Reports
              </button>
              <button
                className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
                onClick={() => setActiveTab("settings")}
              >
                <span>⚙️</span> Settings
              </button>
            </>
          ) : (
            <>
              <button
                className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
                onClick={() => setActiveTab("dashboard")}
              >
                <span>📊</span> Dashboard
              </button>
              <button
                className={`nav-item ${activeTab === "create-exam" ? "active" : ""}`}
                onClick={() => setActiveTab("create-exam")}
              >
                <span>✏️</span> Create Exam
              </button>
              <button
                className={`nav-item ${activeTab === "manage-exams" ? "active" : ""}`}
                onClick={() => setActiveTab("manage-exams")}
              >
                <span>📂</span> Manage Exams
              </button>
              <button
                className={`nav-item ${activeTab === "history" ? "active" : ""}`}
                onClick={() => setActiveTab("history")}
              >
                <span>📜</span> History
              </button>
              <button
                className={`nav-item ${activeTab === "analytics" ? "active" : ""}`}
                onClick={() => setActiveTab("analytics")}
              >
                <span>📈</span> Analytics
              </button>
              <button
                className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
                onClick={() => setActiveTab("settings")}
              >
                <span>⚙️</span> Settings
              </button>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          {activeMode === "candidate" ? (
            <button
              className="mode-toggle-btn"
              onClick={() => {
                setActiveMode("examiner");
                setActiveTab("dashboard");
              }}
            >
              <span>🔒</span> Switch to Examiner Mode
            </button>
          ) : (
            <button
              className="mode-toggle-btn"
              onClick={() => {
                setActiveMode("candidate");
                setActiveTab("dashboard");
              }}
            >
              <span>🔓</span> Lock Examiner Mode
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-title">
            <h2>
              {activeTab === "dashboard" && "Examination Dashboard"}
              {activeTab === "history" && "Attempt History"}
              {activeTab === "reports" && "Examination Reports"}
              {activeTab === "create-exam" && "Create New Examination"}
              {activeTab === "manage-exams" && "Manage Saved Examinations"}
              {activeTab === "analytics" && "Performance Analytics"}
              {activeTab === "settings" && "Application Settings"}
            </h2>
            <span
              className={`badge ${
                activeMode === "candidate" ? "badge-candidate" : "badge-examiner"
              }`}
            >
              {activeMode === "candidate" ? "Candidate Mode" : "Examiner Mode"}
            </span>
          </div>

          <div>
            {ipcStatus === "connected" && (
              <span className="badge badge-success">● IPC Connected</span>
            )}
            {ipcStatus === "connecting" && (
              <span className="badge badge-candidate">Connecting...</span>
            )}
            {ipcStatus === "error" && (
              <span className="badge" style={{ backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#ef4444" }}>
                ✕ IPC Error
              </span>
            )}
          </div>
        </header>

        <div className="content-body">
          {/* Phase 1 Overview Banner */}
          <div className="info-banner">
            <div className="info-banner-icon">🚀</div>
            <div className="info-banner-text">
              <h3>Phase 1: Electron Foundation & Project Identity Active</h3>
              <p>
                The secure Electron desktop shell is initialized with context isolation, disabled Node integration in the renderer,
                and an explicitly mapped <code>window.examTrace</code> API.
              </p>
            </div>
          </div>

          {/* Secure IPC Diagnostics Card */}
          <section className="card">
            <div className="card-title">
              <span>Main Process IPC Diagnostic</span>
              {systemInfo && <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{systemInfo.timestamp}</span>}
            </div>
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "12px" }}>
              The data below is fetched securely from the Electron Main Process via <code>contextBridge</code> (no raw <code>ipcRenderer</code> exposed).
            </p>

            {ipcStatus === "connecting" && <p>Checking IPC connection with Main Process...</p>}

            {ipcStatus === "error" && (
              <div style={{ color: "#ef4444", fontSize: "13px" }}>
                Error connecting to Main Process: {errorMessage}
              </div>
            )}

            {systemInfo && (
              <div className="diagnostic-grid">
                <div className="diag-item">
                  <div className="diag-label">Application Name</div>
                  <div className="diag-value">{systemInfo.appName}</div>
                </div>
                <div className="diag-item">
                  <div className="diag-label">Product Name</div>
                  <div className="diag-value">{systemInfo.productName}</div>
                </div>
                <div className="diag-item">
                  <div className="diag-label">Platform (OS)</div>
                  <div className="diag-value">{systemInfo.platform}</div>
                </div>
                <div className="diag-item">
                  <div className="diag-label">Electron Version</div>
                  <div className="diag-value">v{systemInfo.electronVersion}</div>
                </div>
                <div className="diag-item">
                  <div className="diag-label">Node.js Version</div>
                  <div className="diag-value">v{systemInfo.nodeVersion}</div>
                </div>
                <div className="diag-item" style={{ gridColumn: "1 / -1" }}>
                  <div className="diag-label">Verified Application Data Directory (`app.getPath("userData")`)</div>
                  <div className="diag-value">{systemInfo.userDataPath}</div>
                </div>
              </div>
            )}
          </section>

          {/* Architecture Concept Card */}
          <section className="card">
            <div className="card-title">
              <span>Application Modes Overview</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
              <div style={{ padding: "16px", backgroundColor: "rgba(15, 23, 42, 0.4)", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
                <h4 style={{ fontSize: "14px", color: "var(--color-primary)", marginBottom: "6px" }}>Candidate Mode (Default)</h4>
                <p style={{ fontSize: "12px", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                  Candidates view available examinations, enter their display name, take timed tests with real-time activity monitoring, and review their reports.
                </p>
              </div>
              <div style={{ padding: "16px", backgroundColor: "rgba(15, 23, 42, 0.4)", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
                <h4 style={{ fontSize: "14px", color: "var(--color-warning)", marginBottom: "6px" }}>Examiner Mode (Protected)</h4>
                <p style={{ fontSize: "12px", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                  Examiners unlock management controls using a salted, scrypt-hashed passcode to create MCQs, edit examinations, configure monitoring thresholds, and inspect analytics.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
