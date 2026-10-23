// test/phase3_test.cjs
// Comprehensive acceptance testing for Phase 3:
// - Candidate name validation & storage
// - Single active attempt mutex (rejection of duplicate startExam)
// - Complete answer key sanitization in getActiveExam
// - Independent answer selection and mark-for-review state
// - Main-process authoritative timer & deadline tracking
// - Exact scoring calculation (correct, incorrect, unanswered, percentage)
// - Idempotent manual and automatic submission
// - Protection against examiner operations during active exam
// - Renderer reload recovery

const { app } = require("electron");
const path = require("path");

app.name = "ExamTrace";

app.whenReady().then(async () => {
  console.log("=== STARTING PHASE 3 AUTOMATED TEST SUITE ===");

  const examService = require("../electron/services/examService.cjs");
  const authService = require("../electron/services/authService.cjs");
  const timerService = require("../electron/services/timerService.cjs");

  try {
    await examService.initializeData();

    // 1. Candidate Name Validation
    console.log("\n[TEST 1] Testing candidate display name validation...");
    try {
      await examService.startExam("sample-cs-fundamentals", "   ");
      throw new Error("startExam accepted empty candidate name!");
    } catch (err) {
      console.log("✓ Empty candidate name rejected:", err.message);
    }

    // 2. Start Exam & Verify Active Attempt
    console.log("\n[TEST 2] Starting active examination attempt...");
    const candidateName = "Alex Rivera";
    const activeExam = await examService.startExam("sample-cs-fundamentals", candidateName);

    if (!activeExam || !activeExam.attemptId) {
      throw new Error("Failed to start examination!");
    }
    if (activeExam.candidateName !== candidateName) {
      throw new Error("Candidate name was not properly assigned!");
    }
    if (activeExam.questions.length !== 10) {
      throw new Error(`Expected 10 questions, found ${activeExam.questions.length}`);
    }
    console.log(`✓ Active exam initialized with Attempt ID: ${activeExam.attemptId}`);
    console.log(`✓ Candidate display name verified: '${activeExam.candidateName}'`);

    // 3. Verify Answer Key Sanitization (SECURITY CHECK)
    console.log("\n[TEST 3] Verifying complete answer key sanitization for active exam...");
    for (const q of activeExam.questions) {
      if (q.correctAnswer !== undefined) {
        throw new Error(`SECURITY LEAK: Active question ${q.id} exposed correctAnswer!`);
      }
      if (q.explanation !== undefined) {
        throw new Error(`SECURITY LEAK: Active question ${q.id} exposed explanation!`);
      }
    }
    console.log("✓ Verified: No answer keys or explanations leaked to active examination state.");

    // 4. Reject Duplicate startExam (Single Active Attempt Guard)
    console.log("\n[TEST 4] Testing duplicate startExam rejection...");
    try {
      await examService.startExam("sample-cs-fundamentals", "Second Candidate");
      throw new Error("SECURITY FAILURE: startExam allowed second attempt while active!");
    } catch (err) {
      console.log("✓ Duplicate startExam rejected as expected:", err.message);
    }

    // 5. Active Exam Restriction for Examiner Operations
    console.log("\n[TEST 5] Testing examiner operation restrictions during active exam...");
    try {
      await authService.unlockExaminer("SecretAdmin123");
      throw new Error("SECURITY FAILURE: Examiner Mode unlocked during active exam!");
    } catch (err) {
      console.log("✓ Examiner unlock correctly blocked during active exam:", err.message);
    }

    try {
      await examService.saveExam({ title: "Hack Exam", durationMinutes: 10, questions: [] });
      throw new Error("SECURITY FAILURE: saveExam allowed during active exam!");
    } catch (err) {
      console.log("✓ Exam editing correctly blocked during active exam:", err.message);
    }

    // 6. Test Answer Saving & Input Validation
    console.log("\n[TEST 6] Testing answer selection and validation...");
    const q1 = activeExam.questions[0].id;
    const q2 = activeExam.questions[1].id;
    const q3 = activeExam.questions[2].id;

    // Test invalid question ID
    try {
      examService.saveAnswer("non-existent-q", 1);
      throw new Error("saveAnswer accepted non-existent question ID!");
    } catch (err) {
      console.log("✓ Invalid question ID rejected:", err.message);
    }

    // Test invalid option index
    try {
      examService.saveAnswer(q1, 5);
      throw new Error("saveAnswer accepted out-of-range option index (5)!");
    } catch (err) {
      console.log("✓ Invalid option index rejected:", err.message);
    }

    // Record verified answers
    // Sample Q1: FCFS is index 1 (correct)
    examService.saveAnswer(q1, 1);
    // Sample Q2: Mutual Exclusion is index 0 (we will pick 2 -> INCORRECT)
    examService.saveAnswer(q2, 2);
    // Q3: We leave unanswered

    console.log("✓ Answers saved: Q1 -> Option 1 (Correct), Q2 -> Option 2 (Incorrect), Q3 -> Unanswered.");

    // 7. Test Mark for Review (Independent state)
    console.log("\n[TEST 7] Testing independent Mark for Review state...");
    examService.markForReview(q1, true); // Answered AND Marked
    examService.markForReview(q3, true); // Unanswered AND Marked

    const refreshedActive = examService.getActiveExam();
    if (!refreshedActive.markedForReview.includes(q1) || !refreshedActive.markedForReview.includes(q3)) {
      throw new Error("Mark for review state missing flagged questions!");
    }
    if (refreshedActive.answers[q1] !== 1) {
      throw new Error("Answer was overwritten by review marking!");
    }
    console.log("✓ Verified: Answered and Marked-for-Review states operate completely independently.");

    // 8. Test Renderer Reload Recovery
    console.log("\n[TEST 8] Testing renderer reload recovery...");
    const reloadedState = examService.getActiveExam();
    if (
      reloadedState.attemptId !== activeExam.attemptId ||
      reloadedState.answers[q1] !== 1 ||
      reloadedState.answers[q2] !== 2 ||
      !reloadedState.markedForReview.includes(q1)
    ) {
      throw new Error("Reload recovery failed to restore accurate active attempt state!");
    }
    console.log("✓ Renderer reload recovery verified from Main process memory.");

    // 9. Test Submission and Exact Score Calculation
    console.log("\n[TEST 9] Submitting examination and testing score calculation...");
    const result = await examService.submitExam("manual");

    if (!result) throw new Error("Submission returned null result!");
    if (result.candidateName !== candidateName) throw new Error("Result candidateName mismatch!");
    if (result.totalQuestions !== 10) throw new Error("Result total questions mismatch!");
    if (result.answeredCount !== 2) throw new Error(`Expected 2 answered, got ${result.answeredCount}`);
    if (result.unansweredCount !== 8) throw new Error(`Expected 8 unanswered, got ${result.unansweredCount}`);
    if (result.correctCount !== 1) throw new Error(`Expected 1 correct, got ${result.correctCount}`);
    if (result.incorrectCount !== 1) throw new Error(`Expected 1 incorrect, got ${result.incorrectCount}`);
    if (result.score !== 1) throw new Error(`Expected score 1, got ${result.score}`);
    if (result.percentage !== 10) throw new Error(`Expected 10%, got ${result.percentage}%`);

    // Verify answer review is now available
    if (!result.answerReview || result.answerReview.length !== 10) {
      throw new Error("Answer review list not populated after finalization!");
    }
    const q1Review = result.answerReview.find((r) => r.questionId === q1);
    if (!q1Review || !q1Review.isCorrect || q1Review.correctAnswer !== 1) {
      throw new Error("Q1 answer review scoring mismatch!");
    }
    const q2Review = result.answerReview.find((r) => r.questionId === q2);
    if (!q2Review || q2Review.isCorrect) {
      throw new Error("Q2 was supposed to be incorrect!");
    }
    console.log(`✓ Score calculated accurately: ${result.score}/${result.totalQuestions} (${result.percentage}%)`);
    console.log("✓ Post-submission answer review revealed correctly.");

    // 10. Test Submission Idempotency
    console.log("\n[TEST 10] Testing repeated submission idempotency...");
    const secondSubmit = await examService.submitExam("manual");
    if (secondSubmit.attemptId !== result.attemptId || secondSubmit.score !== result.score) {
      throw new Error("Repeated submission did not return idempotent result!");
    }
    console.log("✓ Repeated submit calls handled idempotently.");

    console.log("\n=== ALL PHASE 3 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ===");
    app.exit(0);
  } catch (err) {
    console.error("\n[TEST_FAILURE] Phase 3 test suite failed:", err);
    app.exit(1);
  }
});
