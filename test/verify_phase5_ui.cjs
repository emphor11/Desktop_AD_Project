// test/verify_phase5_ui.cjs
// UI & Preload integration test for Phase 5:
// Verifies that historical attempts and detailed reports flow smoothly
// into the React interface via the secure window.examTrace bridge.

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
      console.log("[TEST] Testing Phase 5 History & Report APIs in sandboxed renderer...");

      const uiResults = await win.webContents.executeJavaScript(`
        (async () => {
          // 1. Query history
          const history = await window.examTrace.getExamHistory();

          if (!history || history.length === 0) {
            return { error: "No history found" };
          }

          // 2. Fetch full report for the first attempt
          const firstAttemptId = history[0].id;
          const report = await window.examTrace.getExamReport(firstAttemptId);

          return {
            historyCount: history.length,
            firstCandidate: history[0].candidateName,
            reportFound: !!report,
            reportScore: report.score,
            hasTimeline: report.monitoringEvents && report.monitoringEvents.length > 0,
            hasReview: report.answerReview && report.answerReview.length > 0
          };
        })()
      `);

      console.log("[TEST_RESULT] Phase 5 UI Bridge Output:", JSON.stringify(uiResults, null, 2));

      if (
        uiResults.historyCount > 0 &&
        uiResults.reportFound &&
        uiResults.hasTimeline &&
        uiResults.hasReview
      ) {
        console.log("[TEST_SUCCESS] Phase 5 full history and reporting integration test passed cleanly!");
        win.destroy();
        app.exit(0);
      } else {
        console.error("[TEST_ERROR] Phase 5 UI Bridge criteria not met!", uiResults);
        win.destroy();
        app.exit(1);
      }
    } catch (err) {
      console.error("[TEST_ERROR] Phase 5 UI test exception:", err);
      win.destroy();
      app.exit(1);
    }
  });
});
