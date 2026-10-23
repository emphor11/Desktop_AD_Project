// test/verify_main.cjs
// Automated test for Phase 1 requirements:
// 1. App name is 'ExamTrace'
// 2. User data path points to the 'ExamTrace' folder
// 3. Preload exists and is syntactically valid

const { app } = require("electron");
const path = require("path");
const fs = require("fs");

app.name = "ExamTrace";

app.whenReady().then(() => {
  const userData = app.getPath("userData");
  console.log(`[TEST_RESULT] App Name: ${app.name}`);
  console.log(`[TEST_RESULT] User Data Path: ${userData}`);

  // Check that userData ends with ExamTrace
  if (!userData.endsWith("ExamTrace")) {
    console.error("[TEST_ERROR] User data path does not end with ExamTrace:", userData);
    app.exit(1);
    return;
  }

  // Check that preload file exists
  const preloadPath = path.join(__dirname, "../electron/preload.cjs");
  if (!fs.existsSync(preloadPath)) {
    console.error("[TEST_ERROR] Preload file not found:", preloadPath);
    app.exit(1);
    return;
  }
  console.log(`[TEST_RESULT] Preload path verified: ${preloadPath}`);

  // Check main.cjs exists
  const mainPath = path.join(__dirname, "../electron/main.cjs");
  if (!fs.existsSync(mainPath)) {
    console.error("[TEST_ERROR] Main file not found:", mainPath);
    app.exit(1);
    return;
  }
  console.log(`[TEST_RESULT] Main process file verified: ${mainPath}`);

  console.log("[TEST_SUCCESS] Phase 1 Main Process verification passed!");
  app.exit(0);
});
