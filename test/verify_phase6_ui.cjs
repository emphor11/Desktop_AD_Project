// test/verify_phase6_ui.cjs
// UI & Preload integration test for Phase 6:
// Verifies Analytics, Settings, and Examiner security through the window.examTrace context bridge.

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
      console.log("[TEST] Testing Phase 6 Analytics and Settings in sandboxed renderer...");

      const uiResults = await win.webContents.executeJavaScript(`
        (async () => {
          // 1. Get initial settings
          const initialSettings = await window.examTrace.getSettings();

          // 2. Candidate changes theme to light
          const themeUpdate = await window.examTrace.saveSettings({ theme: "light" });

          // 3. Candidate attempts to view analytics (should fail authorization)
          let unauthorizedBlocked = false;
          try {
            await window.examTrace.getAnalytics();
          } catch (err) {
            if (err.message && err.message.includes("Unauthorized")) {
              unauthorizedBlocked = true;
            }
          }

          // 4. Candidate attempts to change examiner-only setting (should fail)
          let settingsBlocked = false;
          try {
            await window.examTrace.saveSettings({ idleThresholdSeconds: 30 });
          } catch (err) {
            if (err.message && err.message.includes("Unauthorized")) {
              settingsBlocked = true;
            }
          }

          // 5. Unlock examiner mode
          const unlockResult = await window.examTrace.unlockExaminer("SecretAdmin123");

          // 6. Fetch analytics as authorized examiner
          const analytics = await window.examTrace.getAnalytics();

          // 7. Change examiner settings
          const examinerSettingsUpdate = await window.examTrace.saveSettings({
            idleThresholdSeconds: 45,
            demoMode: false
          });

          // 8. Re-lock examiner mode and restore theme
          await window.examTrace.saveSettings({ theme: "dark" });
          await window.examTrace.lockExaminer();

          return {
            initialTheme: initialSettings.theme,
            themeUpdateSuccess: themeUpdate.success,
            unauthorizedBlocked,
            settingsBlocked,
            unlockSuccess: unlockResult.success,
            hasAnalytics: analytics && typeof analytics.totalAttempts === "number",
            totalAttempts: analytics ? analytics.totalAttempts : 0,
            hasDistribution: analytics && Array.isArray(analytics.distribution),
            examinerSettingsSuccess: examinerSettingsUpdate.success
          };
        })()
      `);

      console.log("[TEST_RESULT] Phase 6 UI Bridge Output:", JSON.stringify(uiResults, null, 2));

      if (
        uiResults.unauthorizedBlocked &&
        uiResults.settingsBlocked &&
        uiResults.unlockSuccess &&
        uiResults.hasAnalytics &&
        uiResults.hasDistribution &&
        uiResults.examinerSettingsSuccess
      ) {
        console.log("[TEST_SUCCESS] Phase 6 UI and Preload bridge verified cleanly!");
        win.destroy();
        app.exit(0);
      } else {
        console.error("[TEST_ERROR] Phase 6 UI criteria not met!", uiResults);
        win.destroy();
        app.exit(1);
      }
    } catch (err) {
      console.error("[TEST_ERROR] Phase 6 UI test exception:", err);
      win.destroy();
      app.exit(1);
    }
  });
});
