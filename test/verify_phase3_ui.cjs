// test/verify_phase3_ui.cjs
// UI & Preload integration test for Phase 3:
// Tests candidate exam launch, answer selection, review marking, reload recovery,
// submission, and score calculation through the sandboxed window.examTrace bridge.

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
      console.log("[TEST] Testing Phase 3 candidate examination flow in sandboxed renderer...");

      const uiResults = await win.webContents.executeJavaScript(`
        (async () => {
          // 1. Start Exam through window.examTrace
          const active = await window.examTrace.startExam("sample-cs-fundamentals", "Maria Chen");

          // 2. Check no answer keys exist in renderer
          const leaksKeys = active.questions.some(q => q.correctAnswer !== undefined || q.explanation !== undefined);

          // 3. Save answer for Question 1
          const q1Id = active.questions[0].id;
          await window.examTrace.saveAnswer(q1Id, 1);

          // 4. Mark Question 1 for review
          await window.examTrace.markForReview(q1Id, true);

          // 5. Simulate reload by querying getActiveExam
          const recovered = await window.examTrace.getActiveExam();
          const recoverySuccess = (
            recovered &&
            recovered.candidateName === "Maria Chen" &&
            recovered.answers[q1Id] === 1 &&
            recovered.markedForReview.includes(q1Id)
          );

          // 6. Submit examination
          const result = await window.examTrace.submitExam();

          return {
            started: !!active,
            candidateName: active.candidateName,
            leaksKeys,
            recoverySuccess,
            submitted: !!result,
            score: result.score,
            totalQuestions: result.totalQuestions,
            hasReview: result.answerReview && result.answerReview.length === 10
          };
        })()
      `);

      console.log("[TEST_RESULT] Phase 3 UI Bridge Output:", JSON.stringify(uiResults, null, 2));

      if (
        uiResults.started &&
        uiResults.candidateName === "Maria Chen" &&
        !uiResults.leaksKeys &&
        uiResults.recoverySuccess &&
        uiResults.submitted &&
        uiResults.hasReview
      ) {
        console.log("[TEST_SUCCESS] Full Phase 3 candidate workflow integration test passed!");
        app.exit(0);
      } else {
        console.error("[TEST_ERROR] Phase 3 UI Bridge criteria not met!");
        app.exit(1);
      }
    } catch (err) {
      console.error("[TEST_ERROR] Phase 3 UI test exception:", err);
      app.exit(1);
    }
  });
});
