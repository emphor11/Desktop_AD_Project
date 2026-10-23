// src/App.jsx
// Root application component managing mode navigation, authentication lifecycle,
// active examination workspace, and results reporting for ExamTrace.

import React, { useState, useEffect } from "react";
import CandidateDashboard from "./views/CandidateDashboard.jsx";
import ExaminerDashboard from "./views/ExaminerDashboard.jsx";
import ExamCreator from "./views/ExamCreator.jsx";
import ManageExams from "./views/ManageExams.jsx";
import ExamWorkspace from "./views/ExamWorkspace.jsx";
import ExamResultView from "./views/ExamResultView.jsx";
import PasscodeModal from "./components/PasscodeModal.jsx";
import SetupExaminerModal from "./components/SetupExaminerModal.jsx";

export default function App() {
  const [activeMode, setActiveMode] = useState("candidate"); // 'candidate' or 'examiner'
  const [activeTab, setActiveTab] = useState("dashboard");
  const [editingExamId, setEditingExamId] = useState(null);

  // Active Examination Engine State (Phase 3)
  const [activeExam, setActiveExam] = useState(null);
  const [examResult, setExamResult] = useState(null);

  // Authentication & Configuration Status
  const [authStatus, setAuthStatus] = useState(null);
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

  // System Diagnostics Info (from Phase 1)
  const [systemInfo, setSystemInfo] = useState(null);

  useEffect(() => {
    checkAppStatus();
  }, []);

  async function checkAppStatus() {
    try {
      if (window.examTrace) {
        const info = await window.examTrace.ping();
        setSystemInfo(info);

        const status = await window.examTrace.getExaminerStatus();
        setAuthStatus(status);

        // Phase 3: Renderer Reload Recovery
        // Check if an examination was already running in Main memory
        const runningExam = await window.examTrace.getActiveExam();
        if (runningExam) {
          console.log("[ExamTrace] Recovering active examination from Main memory:", runningExam.attemptId);
          setActiveExam(runningExam);
          return;
        }

        // First-run setup check
        if (!status.isConfigured && !status.recoveryRequired) {
          setIsSetupModalOpen(true);
        }

        // Sync examiner unlock status
        if (status.isUnlocked) {
          setActiveMode("examiner");
        } else {
          setActiveMode("candidate");
        }
      }
    } catch (err) {
      console.error("[ExamTrace] Initialization check failed:", err);
    }
  }

  // Handle switching to Examiner Mode
  function handleRequestExaminerMode() {
    if (activeMode === "examiner" || activeExam) return;
    setIsPasscodeModalOpen(true);
  }

  // Handle unlocking Examiner Mode
  function handleUnlockSuccess() {
    setIsPasscodeModalOpen(false);
    setActiveMode("examiner");
    setActiveTab("dashboard");
    checkAppStatus();
  }

  // Handle locking Examiner Mode
  async function handleLockExaminer() {
    try {
      await window.examTrace.lockExaminer();
      setActiveMode("candidate");
      setActiveTab("dashboard");
      setEditingExamId(null);
      checkAppStatus();
    } catch (err) {
      console.error("Failed to lock examiner mode:", err);
    }
  }

  // Handle first-time setup completion
  function handleSetupSuccess() {
    setIsSetupModalOpen(false);
    checkAppStatus();
  }

  // Transition from Manage Exams to Edit form
  function handleEditExam(examId) {
    setEditingExamId(examId);
    setActiveTab("create-exam");
  }

  // Finished creating or editing an exam
  function handleExamSaved() {
    setEditingExamId(null);
    setActiveTab("manage-exams");
  }

  // Phase 3: Launch examination workspace
  function handleBeginActiveExam(examData) {
    setExamResult(null);
    setActiveExam(examData);
  }

  // Phase 3: Examination finished
  function handleExamSubmitted(result) {
    setActiveExam(null);
    setExamResult(result);
  }

  // 1. If an active examination is in progress, show fullscreen workspace
  if (activeExam) {
    return (
      <ExamWorkspace
        activeExam={activeExam}
        onExamSubmitted={handleExamSubmitted}
      />
    );
  }

  // 2. If an examination was just submitted, show results view
  if (examResult) {
    return (
      <div className="app-container" style={{ padding: "32px 48px", overflowY: "auto", display: "block" }}>
        <ExamResultView
          result={examResult}
          onReturnDashboard={() => {
            setExamResult(null);
            setActiveTab("dashboard");
            checkAppStatus();
          }}
        />
      </div>
    );
  }

  // 3. Regular Application Shell (Sidebar + Main Content)
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
                className={`nav-item ${activeTab === "diagnostics" ? "active" : ""}`}
                onClick={() => setActiveTab("diagnostics")}
              >
                <span>🔍</span> System Diagnostics
              </button>
            </>
          ) : (
            <>
              <button
                className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
                onClick={() => {
                  setEditingExamId(null);
                  setActiveTab("dashboard");
                }}
              >
                <span>📊</span> Dashboard
              </button>
              <button
                className={`nav-item ${activeTab === "create-exam" ? "active" : ""}`}
                onClick={() => {
                  setEditingExamId(null);
                  setActiveTab("create-exam");
                }}
              >
                <span>✏️</span> Create Exam
              </button>
              <button
                className={`nav-item ${activeTab === "manage-exams" ? "active" : ""}`}
                onClick={() => {
                  setEditingExamId(null);
                  setActiveTab("manage-exams");
                }}
              >
                <span>📂</span> Manage Exams
              </button>
              <button
                className={`nav-item ${activeTab === "history" ? "active" : ""}`}
                onClick={() => setActiveTab("history")}
              >
                <span>📜</span> Attempt History
              </button>
              <button
                className={`nav-item ${activeTab === "analytics" ? "active" : ""}`}
                onClick={() => setActiveTab("analytics")}
              >
                <span>📈</span> Analytics
              </button>
              <button
                className={`nav-item ${activeTab === "diagnostics" ? "active" : ""}`}
                onClick={() => setActiveTab("diagnostics")}
              >
                <span>🔍</span> Diagnostics
              </button>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          {activeMode === "candidate" ? (
            <button
              className="mode-toggle-btn"
              onClick={handleRequestExaminerMode}
            >
              <span>🔒</span> Switch to Examiner Mode
            </button>
          ) : (
            <button
              className="mode-toggle-btn"
              onClick={handleLockExaminer}
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
              {activeTab === "history" && (activeMode === "candidate" ? "My History" : "Attempt History")}
              {activeTab === "reports" && "My Reports"}
              {activeTab === "create-exam" && (editingExamId ? "Edit Examination" : "Create New Examination")}
              {activeTab === "manage-exams" && "Manage Saved Examinations"}
              {activeTab === "analytics" && "Performance Analytics"}
              {activeTab === "diagnostics" && "System Diagnostics & IPC"}
            </h2>
            <span
              className={`badge ${
                activeMode === "candidate" ? "badge-candidate" : "badge-examiner"
              }`}
            >
              {activeMode === "candidate" ? "Candidate Mode" : "Examiner Mode (Unlocked)"}
            </span>
          </div>

          <div>
            <span className="badge badge-success">● IPC Active</span>
          </div>
        </header>

        <div className="content-body">
          {/* Recovery Error Banner */}
          {authStatus && authStatus.recoveryRequired && (
            <div className="error-alert" style={{ marginBottom: "8px" }}>
              <strong>⚠️ Authentication Recovery Alert:</strong> {authStatus.errorMessage}
            </div>
          )}

          {/* Views Routing */}
          {activeTab === "dashboard" && (
            activeMode === "candidate" ? (
              <CandidateDashboard
                onOpenUnlockModal={handleRequestExaminerMode}
                onBeginActiveExam={handleBeginActiveExam}
              />
            ) : (
              <ExaminerDashboard
                onNavigate={(tab) => {
                  setEditingExamId(null);
                  setActiveTab(tab);
                }}
                onLock={handleLockExaminer}
              />
            )
          )}

          {activeTab === "create-exam" && activeMode === "examiner" && (
            <ExamCreator
              editingExamId={editingExamId}
              onFinished={handleExamSaved}
              onCancel={() => {
                setEditingExamId(null);
                setActiveTab("manage-exams");
              }}
            />
          )}

          {activeTab === "manage-exams" && activeMode === "examiner" && (
            <ManageExams
              onEditExam={handleEditExam}
              onCreateNew={() => {
                setEditingExamId(null);
                setActiveTab("create-exam");
              }}
            />
          )}

          {activeTab === "history" && (
            <div className="card empty-state">
              <h4>Attempt History</h4>
              <p>Completed examination attempts and chronological activity logs will be recorded here in Phase 5.</p>
            </div>
          )}

          {activeTab === "reports" && (
            <div className="card empty-state">
              <h4>Candidate Reports</h4>
              <p>Individual examination scores, answers review, and desktop monitoring timelines will appear here in Phase 5.</p>
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="card empty-state">
              <h4>Performance Analytics</h4>
              <p>Examiner class-wide averages, pass rates, and monitoring interruption analytics will be computed here in Phase 6.</p>
            </div>
          )}

          {activeTab === "diagnostics" && (
            <section className="card">
              <div className="card-title">
                <span>Main Process IPC & Security Diagnostics</span>
                {systemInfo && (
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                    {systemInfo.timestamp}
                  </span>
                )}
              </div>
              <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "16px" }}>
                Current Main-process authorization status and isolated paths:
              </p>

              {systemInfo && (
                <div className="diagnostic-grid">
                  <div className="diag-item">
                    <div className="diag-label">Application</div>
                    <div className="diag-value">{systemInfo.appName}</div>
                  </div>
                  <div className="diag-item">
                    <div className="diag-label">Examiner Mode</div>
                    <div className="diag-value" style={{ color: activeMode === "examiner" ? "#f59e0b" : "#3b82f6" }}>
                      {activeMode === "examiner" ? "UNLOCKED" : "LOCKED"}
                    </div>
                  </div>
                  <div className="diag-item">
                    <div className="diag-label">Examiner Configured</div>
                    <div className="diag-value">
                      {authStatus && authStatus.isConfigured ? "Yes" : "No"}
                    </div>
                  </div>
                  <div className="diag-item">
                    <div className="diag-label">Recovery Error</div>
                    <div className="diag-value">
                      {authStatus && authStatus.recoveryRequired ? "YES (ACTIVE)" : "None"}
                    </div>
                  </div>
                  <div className="diag-item" style={{ gridColumn: "1 / -1" }}>
                    <div className="diag-label">UserData Storage Path</div>
                    <div className="diag-value">{systemInfo.userDataPath}</div>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {/* Examiner Passcode Unlock Modal */}
      <PasscodeModal
        isOpen={isPasscodeModalOpen}
        onClose={() => setIsPasscodeModalOpen(false)}
        onSuccess={handleUnlockSuccess}
      />

      {/* First-Time Setup Modal */}
      <SetupExaminerModal
        isOpen={isSetupModalOpen}
        onSuccess={handleSetupSuccess}
      />
    </div>
  );
}
