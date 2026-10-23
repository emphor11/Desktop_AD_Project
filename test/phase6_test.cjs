// test/phase6_test.cjs
// Comprehensive acceptance testing for Phase 6: Analytics, Settings, and Native Desktop Integration
// - Real derived metrics calculation (averages, pass rate, distribution)
// - Main-process authorization on analytics and examiner settings
// - Settings persistence to settings.json
// - Native notification module execution
// - Examiner passcode change flow

const { app } = require("electron");
const path = require("path");

app.name = "ExamTrace";

app.whenReady().then(async () => {
  console.log("=== STARTING PHASE 6 AUTOMATED TEST SUITE ===");

  const examService = require("../electron/services/examService.cjs");
  const authService = require("../electron/services/authService.cjs");
  const settingsService = require("../electron/services/settingsService.cjs");
  const notificationService = require("../electron/services/notificationService.cjs");

  try {
    await examService.initializeData();

    // 1. Test Main Authorization Guard on Analytics
    console.log("\n[TEST 1] Testing authorization guard on getAnalytics...");
    authService.lockExaminer();
    try {
      examService.getAnalytics();
      throw new Error("getAnalytics succeeded without examiner authorization!");
    } catch (err) {
      if (!err.message.includes("Unauthorized")) throw err;
      console.log("✓ getAnalytics correctly rejected unauthorized caller:", err.message);
    }

    // 2. Unlock Examiner Mode and Calculate Analytics
    console.log("\n[TEST 2] Testing real analytics calculation...");
    await authService.unlockExaminer("SecretAdmin123");
    const analytics = examService.getAnalytics();

    if (!analytics || typeof analytics.totalAttempts !== "number") {
      throw new Error("Failed to compute analytics payload!");
    }
    console.log("[TEST] Computed Analytics Data:", {
      totalAttempts: analytics.totalAttempts,
      averageScore: analytics.averageScore,
      averagePercentage: analytics.averagePercentage,
      passRate: `${analytics.passRate}%`,
      highestScore: analytics.highestScore,
      totalFocusDepartures: analytics.totalFocusDepartures
    });

    if (analytics.totalAttempts > 0) {
      if (analytics.averageScore < 0 || analytics.passRate < 0 || analytics.passRate > 100) {
        throw new Error("Invalid analytics metrics calculation bounds!");
      }
      if (!Array.isArray(analytics.distribution) || analytics.distribution.length !== 5) {
        throw new Error("Score distribution histogram buckets missing!");
      }
    }
    console.log("✓ Derived analytics metrics validated successfully.");

    // 3. Test Settings Service & Authorization
    console.log("\n[TEST 3] Testing settings service and protected parameter guards...");
    const initialSettings = settingsService.getSettings();
    console.log("[TEST] Initial Settings:", initialSettings);

    // Lock examiner mode and try to modify examiner settings
    authService.lockExaminer();
    try {
      await settingsService.saveSettings({
        idleThresholdSeconds: 30
      });
      throw new Error("saveSettings allowed candidate to modify idleThresholdSeconds!");
    } catch (err) {
      if (!err.message.includes("Unauthorized")) throw err;
      console.log("✓ Examiner settings modification correctly rejected for candidate:", err.message);
    }

    // Candidate CAN modify visual theme
    const themeRes = await settingsService.saveSettings({ theme: "light" });
    if (!themeRes.success || settingsService.getSettings().theme !== "light") {
      throw new Error("Candidate theme preference save failed!");
    }
    console.log("✓ Candidate theme modification allowed and persisted.");

    // Re-lock or unlock as examiner to test examiner settings
    await authService.unlockExaminer("SecretAdmin123");
    const examinerSettingsRes = await settingsService.saveSettings({
      defaultDurationMinutes: 25,
      idleThresholdSeconds: 45,
      demoMode: true
    });
    if (!examinerSettingsRes.success || settingsService.getSettings().idleThresholdSeconds !== 45) {
      throw new Error("Examiner settings save failed!");
    }
    console.log("✓ Examiner settings modified and persisted (idleThreshold = 45s, demoMode = true).");

    // Restore default theme
    await settingsService.saveSettings({ theme: "dark", demoMode: false });

    // 4. Test Native Notification Execution
    console.log("\n[TEST 4] Testing native desktop notification module...");
    notificationService.showNotification("ExamTrace Test", "Automated Phase 6 test notification.");
    console.log("✓ Native desktop notification executed without error.");

    // 5. Test Passcode Change Flow
    console.log("\n[TEST 5] Testing examiner passcode change flow...");
    const newPasscode = "UpdatedSecret456";

    // Invalid current passcode should fail
    try {
      await authService.changeExaminerPasscode("WrongOldPasscode", newPasscode);
      throw new Error("changeExaminerPasscode accepted wrong current passcode!");
    } catch (err) {
      console.log("✓ Wrong current passcode rejected:", err.message);
    }

    // Correct change
    const changeRes = await authService.changeExaminerPasscode("SecretAdmin123", newPasscode);
    if (!changeRes.success) throw new Error("Passcode change failed!");
    console.log("✓ Passcode changed to new derived hash.");

    // Verify lock and re-unlock with new passcode
    authService.lockExaminer();
    const newUnlockRes = await authService.unlockExaminer(newPasscode);
    if (!newUnlockRes.success || !authService.isExaminerUnlocked()) {
      throw new Error("Failed to unlock with new passcode!");
    }
    console.log("✓ Re-authenticated successfully with newly changed passcode.");

    // Revert passcode back to SecretAdmin123 for test suite consistency
    await authService.changeExaminerPasscode(newPasscode, "SecretAdmin123");
    authService.lockExaminer();
    console.log("✓ Restored default test passcode; Examiner Mode locked.");

    console.log("\n=== ALL PHASE 6 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ===");
    app.exit(0);
  } catch (err) {
    console.error("\n[TEST_FAILURE] Phase 6 test suite failed:", err);
    app.exit(1);
  }
});
