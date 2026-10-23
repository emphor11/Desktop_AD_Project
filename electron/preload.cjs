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
  deleteExam: (examId) => ipcRenderer.invoke("exam:delete", examId)
});
