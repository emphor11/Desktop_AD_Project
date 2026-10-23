// test/verify_phase2_ui.cjs
// Integration test verifying that the React frontend and Preload bridge
// properly handle Phase 2 examiner workflows, authorization, and data isolation.

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
      console.log("[TEST] Testing Phase 2 renderer bridge...");

      const uiResults = await win.webContents.executeJavaScript(`
        (async () => {
          // 1. Check status
          const status = await window.examTrace.getExaminerStatus();
          
          // 2. Fetch available exams in Candidate Mode
          const exams = await window.examTrace.getAvailableExams();
          const hasAnswerKeys = exams.some(e => e.questions && e.questions.some(q => q.correctAnswer !== undefined));

          // 3. Try to save an exam without unlock (must throw)
          let unauthorizedBlocked = false;
          try {
            await window.examTrace.saveExam({
              title: "Hacked Exam",
              durationMinutes: 10,
              questions: []
            });
          } catch (err) {
            unauthorizedBlocked = true;
          }

          // 4. Unlock with correct passcode
          const unlockRes = await window.examTrace.unlockExaminer("SecretAdmin123");

          // 5. Save a valid exam while unlocked
          const saveRes = await window.examTrace.saveExam({
            title: "Operating Systems Final",
            subject: "OS",
            durationMinutes: 20,
            questions: [
              {
                text: "What is thrashing in OS?",
                options: ["High paging activity", "Deadlock state", "Cache hit", "Process termination"],
                correctAnswer: 0,
                explanation: "Thrashing occurs when excessive time is spent paging instead of executing instructions."
              }
            ]
          });

          // 6. Delete created exam
          await window.examTrace.deleteExam(saveRes.exam.id);

          // 7. Lock examiner mode
          await window.examTrace.lockExaminer();

          return {
            status,
            examCount: exams.length,
            hasAnswerKeys,
            unauthorizedBlocked,
            unlockSuccess: unlockRes.success
          };
        })()
      `);

      console.log("[TEST_RESULT] UI Bridge Verification Output:", JSON.stringify(uiResults, null, 2));

      if (
        uiResults.status.isConfigured &&
        uiResults.examCount > 0 &&
        !uiResults.hasAnswerKeys &&
        uiResults.unauthorizedBlocked &&
        uiResults.unlockSuccess
      ) {
        console.log("[TEST_SUCCESS] Phase 2 renderer integration test passed cleanly!");
        app.exit(0);
      } else {
        console.error("[TEST_ERROR] UI Bridge verification failed criteria!");
        app.exit(1);
      }
    } catch (err) {
      console.error("[TEST_ERROR] Integration test exception:", err);
      app.exit(1);
    }
  });
});
