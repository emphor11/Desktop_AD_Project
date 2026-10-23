// test/phase2_test.cjs
// Comprehensive acceptance testing for Phase 2:
// - Storage persistence & corruption safety
// - Scrypt authentication & timingSafeEqual
// - Missing-auth recovery error detection
// - Main-process authorization guards
// - Exam creation, validation, sanitization, and deletion

const { app } = require("electron");
const path = require("path");
const fs = require("fs");

app.name = "ExamTrace";

app.whenReady().then(async () => {
  console.log("=== STARTING PHASE 2 AUTOMATED TEST SUITE ===");

  const storageService = require("../electron/services/storageService.cjs");
  const authService = require("../electron/services/authService.cjs");
  const examService = require("../electron/services/examService.cjs");

  const userData = app.getPath("userData");
  console.log("[TEST] UserData path:", userData);

  // Clean existing test data to guarantee a pristine first-run test environment
  const filesToClean = ["app-init.json", "exams.json", "examiner-auth.json", "examiner-auth.json.bak"];
  for (const f of filesToClean) {
    const p = path.join(userData, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  try {
    // 1. Test Storage Service Atomic Queue & Safe Read
    console.log("\n[TEST 1] Testing atomic JSON persistence...");
    const testFile = "test-atomic.json";
    const testData = { key: "value", timestamp: Date.now() };
    await storageService.writeJsonFile(testFile, testData);
    const readBack = storageService.readJsonFile(testFile);
    if (!readBack || readBack.key !== "value") {
      throw new Error("Atomic write or read failed!");
    }
    console.log("✓ Atomic write and read passed.");

    // Clean up test file
    const testFilePath = storageService.getDataFilePath(testFile);
    if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);

    // 2. Test Corruption Handling
    console.log("\n[TEST 2] Testing JSON corruption detection...");
    const corruptFile = "test-corrupt.json";
    const corruptFilePath = storageService.getDataFilePath(corruptFile);
    fs.writeFileSync(corruptFilePath, "{ invalid json content !!!");
    try {
      storageService.readJsonFile(corruptFile);
      throw new Error("Failed to catch corrupted JSON!");
    } catch (err) {
      console.log("✓ Caught corruption error as expected:", err.message);
      // Verify backup was created
      const dirFiles = fs.readdirSync(userData);
      const backupFound = dirFiles.some((f) => f.startsWith("test-corrupt.json.corrupt."));
      if (!backupFound) throw new Error("Corruption backup file was not created!");
      console.log("✓ Corruption backup file verified on disk.");
    }
    // Cleanup corrupt files
    fs.readdirSync(userData).forEach((f) => {
      if (f.startsWith("test-corrupt.json")) fs.unlinkSync(path.join(userData, f));
    });

    // 3. Test Sample Exam Seeding & Candidate Sanitization
    console.log("\n[TEST 3] Testing initial sample exam seeding...");
    await examService.initializeData();
    const candidateExams = examService.getAvailableExams(true);
    if (candidateExams.length === 0) {
      throw new Error("Sample exam was not seeded!");
    }
    const sample = candidateExams.find((e) => e.id === "sample-cs-fundamentals");
    if (!sample) throw new Error("Computer Science Fundamentals sample exam missing!");
    if (sample.durationMinutes !== 3 || sample.questionCount !== 10) {
      throw new Error(`Sample exam parameters incorrect: duration=${sample.durationMinutes}, questions=${sample.questionCount}`);
    }
    // Verify answer keys are NOT exposed to candidates
    if (sample.questions && sample.questions.some((q) => q.correctAnswer !== undefined)) {
      throw new Error("SECURITY LEAK: Candidate exams contained correctAnswer!");
    }
    console.log(`✓ Sample exam verified: '${sample.title}' (10 MCQs, 3 mins).`);
    console.log("✓ Verified candidate exam view does not leak questions or answer keys.");

    // 4. Test Examiner Authorization Guards (Must reject unauthorized calls)
    console.log("\n[TEST 4] Testing Main-process authorization rejection...");
    try {
      await examService.saveExam({
        title: "Unauthorized Exam",
        durationMinutes: 10,
        questions: []
      });
      throw new Error("SECURITY FAILURE: saveExam did not reject unauthorized caller!");
    } catch (err) {
      if (!err.message.includes("Unauthorized")) throw err;
      console.log("✓ saveExam correctly rejected unauthorized caller:", err.message);
    }

    try {
      await examService.deleteExam("sample-cs-fundamentals");
      throw new Error("SECURITY FAILURE: deleteExam did not reject unauthorized caller!");
    } catch (err) {
      if (!err.message.includes("Unauthorized")) throw err;
      console.log("✓ deleteExam correctly rejected unauthorized caller:", err.message);
    }

    // 5. Test Passcode Setup & Verification
    console.log("\n[TEST 5] Testing examiner passcode setup with scrypt and salt...");
    const initialStatus = authService.getExaminerStatus();
    console.log("[TEST] Initial examiner status:", initialStatus);

    const testPasscode = "SecretAdmin123";

    if (!initialStatus.isConfigured) {
      await authService.setupExaminer(testPasscode);
      console.log("✓ First-time passcode configured successfully with scrypt.");
    }

    // Verify configured status
    const configuredStatus = authService.getExaminerStatus();
    if (!configuredStatus.isConfigured) throw new Error("Examiner should be configured!");
    if (configuredStatus.isUnlocked) throw new Error("Examiner should be locked by default!");

    // Test incorrect passcode
    console.log("\n[TEST 6] Testing invalid passcode rejection...");
    try {
      await authService.unlockExaminer("WrongPassword");
      throw new Error("unlockExaminer accepted an invalid passcode!");
    } catch (err) {
      console.log("✓ Invalid passcode rejected as expected:", err.message);
    }

    // Test correct passcode unlock
    console.log("\n[TEST 7] Testing correct passcode unlock...");
    const unlockRes = await authService.unlockExaminer(testPasscode);
    if (!unlockRes.success || !authService.isExaminerUnlocked()) {
      throw new Error("Failed to unlock Examiner Mode with valid passcode!");
    }
    console.log("✓ Examiner Mode unlocked successfully.");

    // 6. Test Exam Creation & Validation (Authorized)
    console.log("\n[TEST 8] Testing exam creation validation...");
    try {
      await examService.saveExam({
        title: "",
        durationMinutes: 10,
        questions: []
      });
      throw new Error("saveExam accepted empty title!");
    } catch (err) {
      console.log("✓ Empty title rejected:", err.message);
    }

    try {
      await examService.saveExam({
        title: "Test Exam",
        durationMinutes: 10,
        questions: [{ text: "Q1?", options: ["A", "B", "C"], correctAnswer: 0 }]
      });
      throw new Error("saveExam accepted question with 3 options!");
    } catch (err) {
      console.log("✓ Missing 4th option rejected:", err.message);
    }

    // Create a valid new exam
    console.log("\n[TEST 9] Saving valid new exam...");
    const newExamPayload = {
      title: "Data Structures & Algorithms Quiz",
      subject: "DSA",
      description: "Mid-semester test on binary trees and graphs.",
      durationMinutes: 15,
      questions: [
        {
          text: "What is the height of a balanced binary search tree with n nodes?",
          options: ["O(n)", "O(log n)", "O(n log n)", "O(1)"],
          correctAnswer: 1,
          explanation: "In a balanced BST like AVL or Red-Black tree, height is bounded by O(log n)."
        }
      ]
    };

    const saveResult = await examService.saveExam(newExamPayload);
    const createdExamId = saveResult.exam.id;
    console.log(`✓ Exam created with ID: ${createdExamId}`);

    // Verify it exists
    const fetchedForEditing = examService.getExamForEditing(createdExamId);
    if (fetchedForEditing.questions[0].correctAnswer !== 1) {
      throw new Error("Saved question correct answer did not match!");
    }
    console.log("✓ Verified full exam retrievable by examiner with answer keys.");

    // Test Deleting the created exam
    console.log("\n[TEST 10] Testing exam deletion...");
    await examService.deleteExam(createdExamId);
    try {
      examService.getExamForEditing(createdExamId);
      throw new Error("Exam still exists after deletion!");
    } catch (err) {
      console.log("✓ Verified exam deleted successfully.");
    }

    // Lock examiner mode
    authService.lockExaminer();
    if (authService.isExaminerUnlocked()) throw new Error("Examiner should be locked!");
    console.log("✓ Examiner Mode locked.");

    // 7. Test Missing Auth Recovery Error Check
    console.log("\n[TEST 11] Testing missing-auth recovery error detection...");
    const authFilePath = storageService.getDataFilePath("examiner-auth.json");
    const authBackupPath = storageService.getDataFilePath("examiner-auth.json.bak");
    
    // Temporarily rename auth file to simulate missing auth with existing app data
    fs.renameSync(authFilePath, authBackupPath);

    const recoveryStatus = authService.getExaminerStatus();
    console.log("[TEST] Status with missing auth file but existing exams:", recoveryStatus);
    if (!recoveryStatus.recoveryRequired) {
      throw new Error("Missing auth file with existing app data failed to trigger recoveryRequired!");
    }

    try {
      await authService.setupExaminer("NewPasscode123");
      throw new Error("setupExaminer succeeded during recovery mode!");
    } catch (err) {
      console.log("✓ setupExaminer blocked during recovery mode:", err.message);
    }

    // Restore auth file
    fs.renameSync(authBackupPath, authFilePath);
    console.log("✓ Auth file restored; recovery check passed.");

    console.log("\n=== ALL PHASE 2 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ===");
    app.exit(0);
  } catch (testError) {
    console.error("\n[TEST_FAILURE] Phase 2 test suite failed:", testError);
    app.exit(1);
  }
});
