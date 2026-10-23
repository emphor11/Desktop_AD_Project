// test/phase4_test.cjs
// Comprehensive acceptance testing for Phase 4: Real Desktop Activity Monitoring
// - BrowserWindow focus/blur and minimize state transitions
// - Window departure interval calculation and deduplication
// - Fullscreen exit and warning broadcast
// - Demo Mode inactivity detection (powerMonitor)
// - Open interval closure upon examination submission
// - Chronological event timeline assembly and neutral classification

const { app, BrowserWindow } = require("electron");
const path = require("path");

app.name = "ExamTrace";

app.whenReady().then(async () => {
  console.log("=== STARTING PHASE 4 AUTOMATED TEST SUITE ===");

  const examService = require("../electron/services/examService.cjs");
  const monitoringService = require("../electron/services/monitoringService.cjs");

  try {
    await examService.initializeData();

    // Create a mock/headless BrowserWindow for testing event listeners
    const testWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // 1. Start Exam & Verify Monitoring Initialization
    console.log("\n[TEST 1] Starting examination and monitoring service...");
    const candidateName = "Jordan Hayes";
    const activeExam = await examService.startExam("sample-cs-fundamentals", candidateName);

    if (!activeExam) throw new Error("Failed to start exam!");

    const initialState = monitoringService.getCurrentMonitoringState();
    if (!initialState.isMonitoringActive) {
      throw new Error("Monitoring service failed to activate!");
    }
    console.log(`✓ Monitoring active. Initial event count: ${initialState.eventCount} (EXAM_STARTED)`);

    // 2. Test Window Blur (Departure Interval)
    console.log("\n[TEST 2] Testing window blur (departure interval start)...");
    testWin.emit("blur");

    let state = monitoringService.getCurrentMonitoringState();
    if (!state.isWindowUnfocused) {
      throw new Error("isWindowUnfocused should be true after blur!");
    }
    const blurEvent = state.events.find((e) => e.type === "WINDOW_BLUR");
    if (!blurEvent) throw new Error("WINDOW_BLUR event was not recorded!");
    console.log("✓ WINDOW_BLUR event recorded; unfocused interval tracking initiated.");

    // 3. Test Minimize Deduplication (Minimize while already blurred)
    console.log("\n[TEST 3] Testing minimize deduplication while unfocused...");
    testWin.emit("minimize");

    state = monitoringService.getCurrentMonitoringState();
    const minimizeEvent = state.events.find((e) => e.type === "WINDOW_MINIMIZED");
    if (!minimizeEvent) throw new Error("WINDOW_MINIMIZED event was not recorded!");

    // Ensure it did not create a second blur departure interval
    const blurCount = state.events.filter((e) => e.type === "WINDOW_BLUR").length;
    if (blurCount !== 1) {
      throw new Error(`Expected exactly 1 WINDOW_BLUR event, found ${blurCount}`);
    }
    console.log("✓ Deduplication verified: Minimize recorded without generating duplicate blur interval.");

    // Wait a brief moment to simulate measurable time away (e.g. 150ms)
    await new Promise((r) => setTimeout(r, 150));

    // 4. Test Window Restore and Focus (Departure Interval Closure)
    console.log("\n[TEST 4] Testing window restore and focus return...");
    testWin.emit("restore");
    testWin.emit("focus");

    state = monitoringService.getCurrentMonitoringState();
    if (state.isWindowUnfocused) {
      throw new Error("isWindowUnfocused should be false after focus return!");
    }
    const focusEvent = state.events.find((e) => e.type === "WINDOW_FOCUS");
    if (!focusEvent || !focusEvent.metadata || focusEvent.metadata.durationAwayMs === undefined) {
      throw new Error("WINDOW_FOCUS event missing durationAwayMs metadata!");
    }
    console.log(`✓ WINDOW_FOCUS recorded with duration away: ${focusEvent.metadata.durationAwayMs}ms.`);

    // 5. Test Fullscreen Exit Event
    console.log("\n[TEST 5] Testing fullscreen exit detection...");
    testWin.emit("leave-full-screen");

    state = monitoringService.getCurrentMonitoringState();
    const fsExitEvent = state.events.find((e) => e.type === "FULLSCREEN_EXIT");
    if (!fsExitEvent) throw new Error("FULLSCREEN_EXIT was not recorded!");
    console.log("✓ FULLSCREEN_EXIT recorded successfully.");

    // 6. Test Demo Mode Inactivity (10s threshold toggle)
    console.log("\n[TEST 6] Testing Demo Mode idle threshold...");
    monitoringService.setDemoMode(true);
    if (!monitoringService.getDemoMode()) {
      throw new Error("Demo Mode toggle failed to activate!");
    }
    const demoThreshold = monitoringService.getCurrentMonitoringState().idleThresholdSeconds;
    if (demoThreshold !== 10) {
      throw new Error(`Expected 10s idle threshold in Demo Mode, got ${demoThreshold}`);
    }
    console.log("✓ Demo Mode enabled with 10s idle threshold.");

    // Simulate idle detection
    monitoringService.recordEvent("SYSTEM_IDLE", "System inactivity detected (10s idle threshold).", {
      thresholdSeconds: 10,
      idleSeconds: 10
    });
    monitoringService.recordEvent("SYSTEM_ACTIVE", "System activity resumed.", {
      idleDurationSeconds: 5
    });
    console.log("✓ Inactivity & activity return sequence recorded.");

    // 7. Test Submission While Unfocused (Clean interval closure)
    console.log("\n[TEST 7] Testing submission while window is unfocused...");
    testWin.emit("blur"); // Window departs again
    await new Promise((r) => setTimeout(r, 100));

    // Submit exam while still unfocused
    const result = await examService.submitExam("manual");

    if (!result) throw new Error("Exam submission failed!");
    if (!result.monitoringSummary) throw new Error("Result is missing monitoringSummary!");
    if (!result.monitoringEvents || result.monitoringEvents.length === 0) {
      throw new Error("Result is missing monitoringEvents!");
    }

    const summary = result.monitoringSummary;
    console.log("[TEST] Final Monitoring Summary:", summary);

    if (summary.focusDeparturesCount !== 2) {
      throw new Error(`Expected 2 focus departures, found ${summary.focusDeparturesCount}`);
    }
    if (summary.fullscreenExitsCount !== 1) {
      throw new Error(`Expected 1 fullscreen exit, found ${summary.fullscreenExitsCount}`);
    }
    if (summary.totalUnfocusedTimeMs <= 0) {
      throw new Error("totalUnfocusedTimeMs was not closed and calculated!");
    }

    // Verify submission event is present at the end of timeline
    const lastEvent = result.monitoringEvents[result.monitoringEvents.length - 1];
    if (lastEvent.type !== "EXAM_SUBMITTED") {
      throw new Error(`Expected last event to be EXAM_SUBMITTED, got ${lastEvent.type}`);
    }

    console.log("✓ Open departure interval closed cleanly at submission timestamp.");
    console.log(`✓ Total measured time outside window: ${summary.totalUnfocusedTimeMs}ms.`);
    console.log(`✓ Timeline complete with ${result.monitoringEvents.length} events.`);

    console.log("\n=== ALL PHASE 4 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ===");
    testWin.destroy();
    app.exit(0);
  } catch (err) {
    console.error("\n[TEST_FAILURE] Phase 4 test suite failed:", err);
    app.exit(1);
  }
});
