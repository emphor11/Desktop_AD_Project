// test/verify_phase4_ui.cjs
// UI & Preload integration test for Phase 4:
// Verifies that real-time monitoring events flow across the IPC bridge
// into the sandboxed React renderer and are captured in the final submission report.

const { app, BrowserWindow } = require("electron");
const path = require("path");
const { registerIpcHandlers } = require("../electron/ipc/handlers.cjs");
const examService = require("../electron/services/examService.cjs");

app.name = "ExamTrace";

app.whenReady().then(async () => {
  registerIpcHandlers();
  await examService.initializeData();

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../electron/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, "../dist/index.html"));

  win.webContents.on("did-finish-load", async () => {
    try {
      console.log("[TEST] Testing Phase 4 monitoring timeline in sandboxed renderer...");

      const uiResults = await win.webContents.executeJavaScript(`
        (async () => {
          // 1. Start Exam
          const active = await window.examTrace.startExam("sample-cs-fundamentals", "Carlos Silva");

          // 2. Set Demo Mode
          await window.examTrace.setMonitoringDemoMode(true);
          const demoMode = await window.examTrace.getMonitoringDemoMode();

          // 3. Query initial monitoring state
          const mState = await window.examTrace.getMonitoringState();

          return {
            started: !!active,
            demoMode,
            monitoringActive: mState.isMonitoringActive,
            initialEventCount: mState.eventCount
          };
        })()
      `);

      console.log("[TEST_RESULT] Pre-Event UI Output:", uiResults);

      // Simulate native window events on the BrowserWindow
      win.emit("blur");
      await new Promise((r) => setTimeout(r, 120));
      win.emit("focus");
      await new Promise((r) => setTimeout(r, 60));

      // Submit through renderer
      const finalReport = await win.webContents.executeJavaScript(`
        (async () => {
          return await window.examTrace.submitExam();
        })()
      `);

      console.log("[TEST_RESULT] Monitoring Summary in Result:", finalReport.monitoringSummary);
      console.log("[TEST_RESULT] Events Recorded:", finalReport.monitoringEvents.map((e) => e.type));

      const hasBlur = finalReport.monitoringEvents.some((e) => e.type === "WINDOW_BLUR");
      const hasFocus = finalReport.monitoringEvents.some((e) => e.type === "WINDOW_FOCUS");
      const hasSubmitted = finalReport.monitoringEvents.some((e) => e.type === "EXAM_SUBMITTED");

      if (
        uiResults.started &&
        uiResults.monitoringActive &&
        hasBlur &&
        hasFocus &&
        hasSubmitted &&
        finalReport.monitoringSummary.focusDeparturesCount >= 1
      ) {
        console.log("[TEST_SUCCESS] Phase 4 full desktop monitoring integration test passed cleanly!");
        win.destroy();
        app.exit(0);
      } else {
        console.error("[TEST_ERROR] Phase 4 UI bridge monitoring criteria not met!");
        win.destroy();
        app.exit(1);
      }
    } catch (err) {
      console.error("[TEST_ERROR] Phase 4 UI test exception:", err);
      win.destroy();
      app.exit(1);
    }
  });
});
