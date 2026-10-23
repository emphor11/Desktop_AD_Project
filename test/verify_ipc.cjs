// test/verify_ipc.cjs
// Integration test:
// Launches BrowserWindow with electron/preload.cjs,
// loads dist/index.html,
// executes window.examTrace.ping(),
// and verifies the returned data.

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

app.name = "ExamTrace";

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

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false, // run in background for test
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
      console.log("[TEST] Page loaded. Invoking window.examTrace.ping() in renderer...");
      const result = await win.webContents.executeJavaScript(`
        (async () => {
          if (!window.examTrace || typeof window.examTrace.ping !== 'function') {
            throw new Error('window.examTrace.ping is not defined');
          }
          return await window.examTrace.ping();
        })()
      `);

      console.log("[TEST_RESULT] Received from window.examTrace.ping():", JSON.stringify(result, null, 2));

      if (result.appName === "ExamTrace" && result.productName === "ExamTrace") {
        console.log("[TEST_SUCCESS] Full IPC integration test passed!");
        app.exit(0);
      } else {
        console.error("[TEST_ERROR] Unexpected appName:", result.appName);
        app.exit(1);
      }
    } catch (err) {
      console.error("[TEST_ERROR] Renderer test failed:", err);
      app.exit(1);
    }
  });
});
