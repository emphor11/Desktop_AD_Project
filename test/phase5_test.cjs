// test/phase5_test.cjs
// Comprehensive acceptance testing for Phase 5: Durable Attempts, History, Reports, and Restart Recovery
// - Persistent storage in attempts.json and active-attempt.json
// - Checkpoint updates during exam
// - Complete historical report preservation against exam modifications
// - History API returning shared local attempt records
// - Restart recovery of active unexpired attempt
// - Restart recovery of expired attempt (idempotent auto-submit on reopening)

const { app } = require("electron");
const path = require("path");
const fs = require("fs");

app.name = "ExamTrace";

app.whenReady().then(async () => {
  console.log("=== STARTING PHASE 5 AUTOMATED TEST SUITE ===");

  const storageService = require("../electron/services/storageService.cjs");
  const examService = require("../electron/services/examService.cjs");
  const authService = require("../electron/services/authService.cjs");

  try {
    await examService.initializeData();

    // 1. Test Checkpointing on startExam
    console.log("\n[TEST 1] Testing active attempt checkpoint creation on startExam...");
    const candidateName = "Elena Rostova";
    const activeExam = await examService.startExam("sample-cs-fundamentals", candidateName);

    // Verify active-attempt.json exists on disk
    if (!storageService.fileExists("active-attempt.json")) {
      throw new Error("active-attempt.json was not created upon startExam!");
    }
    const checkpoint = storageService.readJsonFile("active-attempt.json");
    if (!checkpoint || checkpoint.candidateName !== candidateName) {
      throw new Error("Checkpoint content mismatch!");
    }
    console.log(`✓ active-attempt.json verified on disk for attempt: ${checkpoint.id}`);

    // 2. Test Checkpoint Updates on Answer & Review
    console.log("\n[TEST 2] Testing checkpoint updates on answer and review changes...");
    const q1 = activeExam.questions[0].id;
    examService.saveAnswer(q1, 1);
    examService.markForReview(q1, true);

    // Wait a brief moment for async write
    await new Promise((r) => setTimeout(r, 60));

    const updatedCheckpoint = storageService.readJsonFile("active-attempt.json");
    if (updatedCheckpoint.answers[q1] !== 1 || !updatedCheckpoint.markedForReview.includes(q1)) {
      throw new Error("active-attempt.json failed to reflect updated answers or review marks!");
    }
    console.log("✓ Checkpoint verified with updated answer and review flag.");

    // 3. Test Submission Persistence to attempts.json & Checkpoint Cleanup
    console.log("\n[TEST 3] Testing finalization persistence to attempts.json and checkpoint cleanup...");
    const submittedResult = await examService.submitExam("manual");

    if (storageService.fileExists("active-attempt.json")) {
      throw new Error("active-attempt.json was not removed after finalization!");
    }

    const attemptsHistory = storageService.readJsonFile("attempts.json", []);
    const savedAttempt = attemptsHistory.find((a) => a.id === submittedResult.attemptId);
    if (!savedAttempt) {
      throw new Error("Finalized attempt was not persisted to attempts.json!");
    }
    if (savedAttempt.result.score !== submittedResult.score) {
      throw new Error("Persisted score mismatch in attempts.json!");
    }
    console.log(`✓ Finalized attempt successfully persisted to attempts.json (Total attempts: ${attemptsHistory.length}).`);
    console.log("✓ active-attempt.json checkpoint cleanly deleted.");

    // 4. Test History API
    console.log("\n[TEST 4] Testing getExamHistory API...");
    const historyList = examService.getExamHistory();
    if (!Array.isArray(historyList) || historyList.length === 0) {
      throw new Error("getExamHistory returned empty list!");
    }
    const latestHistory = historyList[0];
    if (latestHistory.candidateName !== candidateName || latestHistory.id !== submittedResult.attemptId) {
      throw new Error("History list latest entry mismatch!");
    }
    console.log(`✓ History list verified: ${historyList.length} total attempt(s) loaded.`);

    // 5. Test Historical Immutability (Exam definition change does NOT alter past reports)
    console.log("\n[TEST 5] Testing historical report immutability...");
    const reportBefore = examService.getExamReport(submittedResult.attemptId);
    if (!reportBefore || !reportBefore.answerReview) {
      throw new Error("Failed to load historical report!");
    }

    // Now unlock examiner and delete/modify the exam definition
    await authService.unlockExaminer("SecretAdmin123");
    const newExamPayload = {
      title: "Modified Exam Definition",
      subject: "Updated Subject",
      durationMinutes: 45,
      questions: [
        {
          text: "Brand new question?",
          options: ["A", "B", "C", "D"],
          correctAnswer: 0,
          explanation: "New explanation"
        }
      ]
    };
    await examService.saveExam(newExamPayload);
    authService.lockExaminer();

    // Query historical report again
    const reportAfter = examService.getExamReport(submittedResult.attemptId);
    if (
      reportAfter.examTitle !== "Computer Science Fundamentals" ||
      reportAfter.totalQuestions !== 10 ||
      reportAfter.score !== submittedResult.score
    ) {
      throw new Error("Historical report was corrupted by subsequent exam modifications!");
    }
    console.log("✓ Historical report verified: Stored snapshot remains intact and immutable.");

    // 6. Test Restart Recovery: Valid In-Progress Attempt
    console.log("\n[TEST 6] Testing application restart recovery for valid unexpired attempt...");
    // Simulate active attempt in active-attempt.json with future deadline
    const futureDeadline = new Date(Date.now() + 120000).toISOString();
    const mockCheckpoint = {
      id: "attempt-mock-recovery-01",
      examId: "sample-cs-fundamentals",
      candidateName: "Marcus Vance",
      examSnapshot: examService.getInternalExamById("sample-cs-fundamentals"),
      startedAt: new Date().toISOString(),
      deadline: futureDeadline,
      status: "in_progress",
      answers: { "q-sample-001": 1 },
      markedForReview: ["q-sample-001"],
      events: []
    };
    await storageService.writeJsonFile("active-attempt.json", mockCheckpoint);

    // Call recovery routine as main.cjs would upon app launch
    const recoveredActive = await examService.restoreActiveAttemptOrFinalize();
    if (!recoveredActive || recoveredActive.attemptId !== mockCheckpoint.id) {
      throw new Error("Failed to restore unexpired active attempt from checkpoint!");
    }
    if (recoveredActive.candidateName !== "Marcus Vance" || recoveredActive.answers["q-sample-001"] !== 1) {
      throw new Error("Restored attempt state corrupted!");
    }
    console.log(`✓ Active attempt restored from disk with remaining time: ${Math.round(recoveredActive.remainingMs / 1000)}s.`);

    // Finalize the recovered mock exam to clean up
    await examService.submitExam("manual");

    // 7. Test Restart Recovery: Expired Attempt While App Was Closed
    console.log("\n[TEST 7] Testing restart recovery for attempt expired while application was closed...");
    const pastDeadline = new Date(Date.now() - 5000).toISOString(); // Expired 5 seconds ago
    const mockExpiredCheckpoint = {
      id: "attempt-mock-expired-02",
      examId: "sample-cs-fundamentals",
      candidateName: "Siddharth Rao",
      examSnapshot: examService.getInternalExamById("sample-cs-fundamentals"),
      startedAt: new Date(Date.now() - 185000).toISOString(),
      deadline: pastDeadline,
      status: "in_progress",
      answers: { "q-sample-001": 1 }, // Correct option (+1)
      markedForReview: [],
      events: []
    };
    await storageService.writeJsonFile("active-attempt.json", mockExpiredCheckpoint);

    // Call recovery routine
    const finalizedExpired = await examService.restoreActiveAttemptOrFinalize();
    if (!finalizedExpired || finalizedExpired.attemptId !== mockExpiredCheckpoint.id) {
      throw new Error("Expired attempt was not recovered and finalized!");
    }
    if (finalizedExpired.submissionType !== "auto_submitted" || finalizedExpired.score !== 1) {
      throw new Error("Expired attempt scoring or submissionType mismatch!");
    }
    // Checkpoint must be deleted
    if (storageService.fileExists("active-attempt.json")) {
      throw new Error("Expired checkpoint was not deleted after finalization!");
    }
    // Factual closure event verified
    const closedEvent = finalizedExpired.monitoringEvents.find((e) => e.type === "APPLICATION_CLOSED_EXPIRATION");
    if (!closedEvent) {
      throw new Error("APPLICATION_CLOSED_EXPIRATION event not recorded!");
    }
    console.log("✓ Expired attempt cleanly finalized on launch as auto_submitted.");
    console.log("✓ APPLICATION_CLOSED_EXPIRATION event recorded without fabricating mock activity.");

    console.log("\n=== ALL PHASE 5 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ===");
    app.exit(0);
  } catch (err) {
    console.error("\n[TEST_FAILURE] Phase 5 test suite failed:", err);
    app.exit(1);
  }
});
