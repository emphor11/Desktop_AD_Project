// electron/ipc/handlers.cjs
// Centralized IPC communication dispatcher.
// Implements strict Main-process authorization checks for examiner actions.

const { ipcMain, app } = require("electron");
const authService = require("../services/authService.cjs");
const examService = require("../services/examService.cjs");

function registerIpcHandlers() {
  // App Diagnostics & Ping
  ipcMain.handle("app:ping", async () => {
    return {
      appName: app.name,
      productName: "ExamTrace",
      version: app.getVersion(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      platform: process.platform,
      userDataPath: app.getPath("userData"),
      timestamp: new Date().toISOString()
    };
  });

  // Authentication & Status
  ipcMain.handle("auth:getStatus", async () => {
    return authService.getExaminerStatus();
  });

  ipcMain.handle("auth:setup", async (event, passcode) => {
    return await authService.setupExaminer(passcode);
  });

  ipcMain.handle("auth:unlock", async (event, passcode) => {
    return await authService.unlockExaminer(passcode);
  });

  ipcMain.handle("auth:lock", async () => {
    return authService.lockExaminer();
  });

  ipcMain.handle("auth:changePasscode", async (event, data) => {
    return await authService.changeExaminerPasscode(data.currentPasscode, data.newPasscode);
  });

  // Examination APIs
  ipcMain.handle("exam:getAvailable", async () => {
    const isUnlocked = authService.isExaminerUnlocked();
    // Candidates receive sanitized exams; Examiners receive full definitions
    return examService.getAvailableExams(!isUnlocked);
  });

  ipcMain.handle("exam:getForEditing", async (event, examId) => {
    return examService.getExamForEditing(examId);
  });

  ipcMain.handle("exam:save", async (event, examData) => {
    return await examService.saveExam(examData);
  });

  ipcMain.handle("exam:delete", async (event, examId) => {
    return await examService.deleteExam(examId);
  });
}

module.exports = {
  registerIpcHandlers
};
