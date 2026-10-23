// electron/preload.cjs
// Sandboxed preload script
// Securely bridges the Main Process to the Renderer Process via contextBridge.

const { contextBridge, ipcRenderer } = require("electron");

// Expose a narrow, strictly typed API to the global window object
contextBridge.exposeInMainWorld("examTrace", {
  // Phase 1: IPC Connectivity & System Information
  ping: () => ipcRenderer.invoke("app:ping"),

  // Phase 2: Examiner Authentication & Authorization
  getExaminerStatus: () => ipcRenderer.invoke("auth:getStatus"),
  setupExaminer: (passcode) => ipcRenderer.invoke("auth:setup", passcode),
  unlockExaminer: (passcode) => ipcRenderer.invoke("auth:unlock", passcode),
  lockExaminer: () => ipcRenderer.invoke("auth:lock"),
  changeExaminerPasscode: (data) => ipcRenderer.invoke("auth:changePasscode", data),

  // Phase 2: Examination Management
  getAvailableExams: () => ipcRenderer.invoke("exam:getAvailable"),
  getExamForEditing: (examId) => ipcRenderer.invoke("exam:getForEditing", examId),
  saveExam: (examData) => ipcRenderer.invoke("exam:save", examData),
  deleteExam: (examId) => ipcRenderer.invoke("exam:delete", examId),

  // Phase 3: Active Examination Engine
  startExam: (examId, candidateName) => ipcRenderer.invoke("exam:start", { examId, candidateName }),
  getActiveExam: () => ipcRenderer.invoke("exam:getActive"),
  saveAnswer: (questionId, answerIndex) => ipcRenderer.invoke("exam:saveAnswer", { questionId, answerIndex }),
  markForReview: (questionId, marked) => ipcRenderer.invoke("exam:markForReview", { questionId, marked }),
  submitExam: () => ipcRenderer.invoke("exam:submit"),
  getLatestResult: () => ipcRenderer.invoke("exam:getLatestResult"),

  // Phase 5: History & Reports
  getExamHistory: () => ipcRenderer.invoke("exam:getHistory"),
  getExamReport: (attemptId) => ipcRenderer.invoke("exam:getReport", attemptId),

  // Phase 6: Analytics & Settings
  getAnalytics: () => ipcRenderer.invoke("analytics:get"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),

  // Phase 4: Desktop Activity Monitoring
  getMonitoringDemoMode: () => ipcRenderer.invoke("monitoring:getDemoMode"),
  setMonitoringDemoMode: (enabled) => ipcRenderer.invoke("monitoring:setDemoMode", enabled),
  getMonitoringState: () => ipcRenderer.invoke("monitoring:getState"),
  setFullScreen: (enabled) => ipcRenderer.invoke("window:setFullScreen", enabled),

  // Event Subscriptions with unbind handlers
  onTimerUpdate: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on("exam:timerTick", handler);
    return () => ipcRenderer.removeListener("exam:timerTick", handler);
  },
  onExamCompleted: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on("exam:completed", handler);
    return () => ipcRenderer.removeListener("exam:completed", handler);
  },
  onMonitoringEvent: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on("monitoring:event", handler);
    return () => ipcRenderer.removeListener("monitoring:event", handler);
  },
  onFullscreenWarning: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on("monitoring:fullscreenWarning", handler);
    return () => ipcRenderer.removeListener("monitoring:fullscreenWarning", handler);
  }
});
