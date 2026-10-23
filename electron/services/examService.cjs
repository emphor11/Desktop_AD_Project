// electron/services/examService.cjs
// Handles examination management (CRUD), initial sample exam seeding,
// candidate examination engine, authoritative timer, answer validation, and score calculation.

const crypto = require("crypto");
const storageService = require("./storageService.cjs");
const authService = require("./authService.cjs");
const timerService = require("./timerService.cjs");
const monitoringService = require("./monitoringService.cjs");
const notificationService = require("./notificationService.cjs");
const { BrowserWindow } = require("electron");

const EXAMS_FILE = "exams.json";
const INIT_FILE = "app-init.json";
const ATTEMPTS_FILE = "attempts.json";
const ACTIVE_ATTEMPT_FILE = "active-attempt.json";

// In-memory active examination attempt (Main process authoritative state)
let activeAttempt = null;
let latestFinalizedAttempt = null;

// The 10 built-in, verified Computer Science Fundamentals MCQs
const SAMPLE_EXAM_QUESTIONS = [
  {
    id: "q-sample-001",
    text: "Which CPU scheduling algorithm is strictly non-preemptive by definition?",
    options: [
      "Round Robin (RR)",
      "First-Come, First-Served (FCFS)",
      "Shortest Remaining Time First (SRTF)",
      "Multilevel Queue Scheduling"
    ],
    correctAnswer: 1,
    explanation: "FCFS executes processes strictly in the order they arrive in the ready queue without interrupting running processes."
  },
  {
    id: "q-sample-002",
    text: "Which of the following is a necessary condition for deadlock where a resource can only be held by one process at a time?",
    options: [
      "Mutual Exclusion",
      "Hold and Wait",
      "No Preemption",
      "Circular Wait"
    ],
    correctAnswer: 0,
    explanation: "Mutual Exclusion specifies that at least one resource must be held in a non-shareable mode by only one process at a time."
  },
  {
    id: "q-sample-003",
    text: "In SQL, which clause is used to filter records resulting from a GROUP BY aggregation?",
    options: [
      "WHERE",
      "HAVING",
      "ORDER BY",
      "LIMIT"
    ],
    correctAnswer: 1,
    explanation: "The HAVING clause was introduced in SQL because the WHERE keyword cannot be applied directly to aggregate functions."
  },
  {
    id: "q-sample-004",
    text: "Which relational database normal form eliminates transitive functional dependencies?",
    options: [
      "First Normal Form (1NF)",
      "Second Normal Form (2NF)",
      "Third Normal Form (3NF)",
      "Boyce-Codd Normal Form (BCNF)"
    ],
    correctAnswer: 2,
    explanation: "A table is in 3NF if it is in 2NF and no non-prime attribute is transitively dependent on the candidate key."
  },
  {
    id: "q-sample-005",
    text: "Which layer of the OSI model is responsible for end-to-end process-to-process delivery and port addressing?",
    options: [
      "Network Layer",
      "Data Link Layer",
      "Transport Layer",
      "Session Layer"
    ],
    correctAnswer: 2,
    explanation: "The Transport Layer (TCP and UDP) provides process-to-process communication using port addresses."
  },
  {
    id: "q-sample-006",
    text: "Which network protocol translates human-readable domain names into numerical IP addresses?",
    options: [
      "DHCP",
      "DNS",
      "ARP",
      "ICMP"
    ],
    correctAnswer: 1,
    explanation: "DNS (Domain Name System) resolves domain names to their corresponding IP addresses."
  },
  {
    id: "q-sample-007",
    text: "What is the worst-case time complexity of standard QuickSort?",
    options: [
      "O(n log n)",
      "O(n)",
      "O(n²)",
      "O(log n)"
    ],
    correctAnswer: 2,
    explanation: "QuickSort exhibits O(n²) worst-case time complexity when the partition selected is unbalanced (e.g., repeatedly selecting the maximum or minimum element)."
  },
  {
    id: "q-sample-008",
    text: "Which data structure operates strictly on a Last-In, First-Out (LIFO) access pattern?",
    options: [
      "Queue",
      "Stack",
      "Binary Heap",
      "Doubly Linked List"
    ],
    correctAnswer: 1,
    explanation: "A Stack operates on the LIFO principle: elements inserted last are popped first."
  },
  {
    id: "q-sample-009",
    text: "What is the primary architectural purpose of CPU cache memory?",
    options: [
      "To provide permanent non-volatile mass storage",
      "To bridge the speed mismatch between the fast processor and slower main RAM",
      "To hold the system BIOS firmware",
      "To implement operating system virtual memory paging"
    ],
    correctAnswer: 1,
    explanation: "Cache memory is a small, ultra-fast memory located on or near the processor to store frequently used data and instructions."
  },
  {
    id: "q-sample-010",
    text: "What is the worst-case number of comparisons in Binary Search for a sorted array of 1024 elements?",
    options: [
      "10",
      "11",
      "512",
      "1024"
    ],
    correctAnswer: 1,
    explanation: "The maximum number of comparisons for binary search on n elements is floor(log₂(n)) + 1. For 1024 elements: floor(10) + 1 = 11 comparisons."
  }
];

/**
 * Initializes default data if this is the very first run of the app.
 * Seeds the sample exam once and records app-init.json.
 */
async function initializeData() {
  const isInitialized = storageService.fileExists(INIT_FILE);

  if (!isInitialized) {
    const existingExams = storageService.readJsonFile(EXAMS_FILE, null);

    if (!existingExams) {
      const sampleExam = {
        id: "sample-cs-fundamentals",
        title: "Computer Science Fundamentals",
        subject: "Computer Science",
        description: "Official introductory practice examination covering Operating Systems, DBMS, Networking, and Core Data Structures.",
        durationMinutes: 3,
        questions: SAMPLE_EXAM_QUESTIONS,
        isSample: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await storageService.writeJsonFile(EXAMS_FILE, [sampleExam]);
      console.log("[ExamService] Built-in sample exam initialized.");
    }

    await storageService.writeJsonFile(INIT_FILE, {
      initializedAt: new Date().toISOString(),
      sampleExamSeeded: true,
      firstRunSetupCompleted: false
    });
  }
}

/**
 * Sanitizes an array of questions for candidate-safe consumption.
 * Explicitly strips correctAnswer and explanation.
 */
function sanitizeQuestionsForCandidate(questions) {
  if (!Array.isArray(questions)) return [];
  return questions.map((q) => ({
    id: q.id,
    text: q.text,
    options: q.options
  }));
}

/**
 * Checks whether an examination attempt is currently in progress.
 */
function isExamActive() {
  return activeAttempt !== null && activeAttempt.status === "in_progress";
}

/**
 * Gets all exams.
 * If called for Candidate Mode, returns candidate-safe questions without answer keys.
 */
function getAvailableExams(forCandidate = true) {
  const exams = storageService.readJsonFile(EXAMS_FILE, []);

  if (forCandidate) {
    return exams.map((exam) => ({
      id: exam.id,
      title: exam.title,
      subject: exam.subject,
      description: exam.description || "",
      durationMinutes: exam.durationMinutes,
      questionCount: exam.questions ? exam.questions.length : 0,
      createdAt: exam.createdAt,
      isSample: !!exam.isSample
    }));
  }

  // Examiner view
  return exams;
}

/**
 * Fetches a single full exam for editing.
 * Protected by Main process authorization.
 */
function getExamForEditing(examId) {
  if (!authService.isExaminerUnlocked()) {
    throw new Error("Unauthorized: Examiner Mode must be unlocked to view exam editing details.");
  }

  const exams = storageService.readJsonFile(EXAMS_FILE, []);
  const exam = exams.find((e) => e.id === examId);

  if (!exam) {
    throw new Error(`Examination with ID '${examId}' not found.`);
  }

  return exam;
}

/**
 * Fetches an internal exam by ID with full question snapshots.
 */
function getInternalExamById(examId) {
  const exams = storageService.readJsonFile(EXAMS_FILE, []);
  return exams.find((e) => e.id === examId) || null;
}

/**
 * Validates examination inputs before saving.
 */
function validateExamData(examData) {
  if (!examData || typeof examData !== "object") {
    throw new Error("Invalid examination payload.");
  }

  const title = (examData.title || "").trim();
  if (!title) {
    throw new Error("Examination title is required.");
  }

  const durationMinutes = Number(examData.durationMinutes);
  if (!durationMinutes || isNaN(durationMinutes) || durationMinutes <= 0) {
    throw new Error("Examination duration must be a positive number.");
  }

  const questions = examData.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("An examination must contain at least one question.");
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qNum = i + 1;

    if (!q.text || typeof q.text !== "string" || !q.text.trim()) {
      throw new Error(`Question ${qNum} is missing question text.`);
    }

    if (!Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`Question ${qNum} must have exactly 4 options.`);
    }

    for (let j = 0; j < 4; j++) {
      if (!q.options[j] || typeof q.options[j] !== "string" || !q.options[j].trim()) {
        throw new Error(`Question ${qNum}, Option ${j + 1} cannot be empty.`);
      }
    }

    const correctAnswer = Number(q.correctAnswer);
    if (isNaN(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) {
      throw new Error(`Question ${qNum} must have a valid correct answer selected (Option 1 to 4).`);
    }
  }
}

/**
 * Saves (creates or updates) an examination.
 */
async function saveExam(examData) {
  if (!authService.isExaminerUnlocked()) {
    throw new Error("Unauthorized: Examiner Mode must be unlocked to save an examination.");
  }

  if (isExamActive()) {
    throw new Error("Cannot modify examinations while an examination is currently active.");
  }

  validateExamData(examData);

  const exams = storageService.readJsonFile(EXAMS_FILE, []);
  const now = new Date().toISOString();

  const sanitizedQuestions = examData.questions.map((q) => ({
    id: q.id || crypto.randomUUID(),
    text: q.text.trim(),
    options: q.options.map((opt) => opt.trim()),
    correctAnswer: Number(q.correctAnswer),
    explanation: (q.explanation || "").trim()
  }));

  let savedExam;

  if (examData.id) {
    const index = exams.findIndex((e) => e.id === examData.id);
    if (index === -1) {
      throw new Error(`Examination with ID '${examData.id}' not found.`);
    }

    savedExam = {
      ...exams[index],
      title: examData.title.trim(),
      subject: (examData.subject || "").trim(),
      description: (examData.description || "").trim(),
      durationMinutes: Number(examData.durationMinutes),
      questions: sanitizedQuestions,
      updatedAt: now
    };

    exams[index] = savedExam;
  } else {
    savedExam = {
      id: crypto.randomUUID(),
      title: examData.title.trim(),
      subject: (examData.subject || "General").trim(),
      description: (examData.description || "").trim(),
      durationMinutes: Number(examData.durationMinutes),
      questions: sanitizedQuestions,
      createdAt: now,
      updatedAt: now
    };

    exams.push(savedExam);
  }

  await storageService.writeJsonFile(EXAMS_FILE, exams);

  return { success: true, exam: savedExam };
}

/**
 * Deletes an examination by ID.
 */
async function deleteExam(examId) {
  if (!authService.isExaminerUnlocked()) {
    throw new Error("Unauthorized: Examiner Mode must be unlocked to delete an examination.");
  }

  if (isExamActive()) {
    throw new Error("Cannot delete examinations while an examination is currently active.");
  }

  const exams = storageService.readJsonFile(EXAMS_FILE, []);
  const initialLength = exams.length;
  const filteredExams = exams.filter((e) => e.id !== examId);

  if (filteredExams.length === initialLength) {
    throw new Error(`Examination with ID '${examId}' not found.`);
  }

  await storageService.writeJsonFile(EXAMS_FILE, filteredExams);

  return { success: true, message: "Examination deleted successfully." };
}

// ==========================================
// PHASE 3 & PHASE 5: EXAMINATION ENGINE & CHECKPOINTING
// ==========================================

/**
 * Asynchronously persists the in-progress attempt checkpoint.
 */
async function checkpointActiveAttempt() {
  if (activeAttempt && activeAttempt.status === "in_progress") {
    try {
      await storageService.writeJsonFile(ACTIVE_ATTEMPT_FILE, activeAttempt);
    } catch (err) {
      console.error("[ExamService] Checkpoint write failed:", err);
    }
  }
}

/**
 * Starts a timed examination attempt for a candidate.
 * Strictly rejects if an attempt is already in progress.
 */
async function startExam(examId, candidateName) {
  if (isExamActive()) {
    throw new Error("An examination is already in progress. Only one active attempt is allowed at a time.");
  }

  const trimmedName = (candidateName || "").trim();
  if (!trimmedName) {
    throw new Error("Candidate display name is required to begin the examination.");
  }

  const exam = getInternalExamById(examId);
  if (!exam) {
    throw new Error(`Examination with ID '${examId}' not found.`);
  }

  if (!exam.questions || exam.questions.length === 0) {
    throw new Error("Cannot start an examination with no questions.");
  }

  const startTime = Date.now();
  const durationMs = Number(exam.durationMinutes) * 60 * 1000;
  const deadline = startTime + durationMs;

  activeAttempt = {
    id: "attempt-" + crypto.randomUUID(),
    examId: exam.id,
    candidateName: trimmedName,
    examSnapshot: JSON.parse(JSON.stringify(exam)), // Internal snapshot with answer keys
    startedAt: new Date(startTime).toISOString(),
    endedAt: null,
    deadline: new Date(deadline).toISOString(),
    status: "in_progress",
    answers: {},
    markedForReview: [],
    events: [],
    result: null
  };

  // Start real desktop activity monitoring on the active window
  const activeWin = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (activeWin) {
    monitoringService.startMonitoring(activeWin);
  }

  // Start the authoritative Main-process countdown timer
  timerService.startTimer(deadline, async () => {
    console.log("[ExamService] Examination deadline expired. Executing auto-submission...");
    try {
      await submitExam("auto");
    } catch (err) {
      console.error("[ExamService] Error during auto-submission:", err);
    }
  });

  // Checkpoint in-progress examination to active-attempt.json
  await checkpointActiveAttempt();

  return getActiveExam();
}

/**
 * Returns safe examination state for the renderer.
 * Strictly strips correctAnswer and explanation from question objects.
 */
function getActiveExam() {
  if (!isExamActive()) {
    return null;
  }

  const deadlineMs = new Date(activeAttempt.deadline).getTime();
  const remainingMs = Math.max(0, deadlineMs - Date.now());

  return {
    attemptId: activeAttempt.id,
    examId: activeAttempt.examId,
    candidateName: activeAttempt.candidateName,
    title: activeAttempt.examSnapshot.title,
    subject: activeAttempt.examSnapshot.subject,
    description: activeAttempt.examSnapshot.description,
    durationMinutes: activeAttempt.examSnapshot.durationMinutes,
    questions: sanitizeQuestionsForCandidate(activeAttempt.examSnapshot.questions),
    answers: { ...activeAttempt.answers },
    markedForReview: [...activeAttempt.markedForReview],
    startedAt: activeAttempt.startedAt,
    deadline: activeAttempt.deadline,
    remainingMs,
    monitoringState: monitoringService.getCurrentMonitoringState()
  };
}

/**
 * Saves a candidate's answer for a question.
 */
function saveAnswer(questionId, answerIndex) {
  if (!isExamActive()) {
    throw new Error("No active examination attempt in progress.");
  }

  const deadlineMs = new Date(activeAttempt.deadline).getTime();
  if (Date.now() >= deadlineMs) {
    throw new Error("Examination deadline has expired. No further answers can be accepted.");
  }

  const questionExists = activeAttempt.examSnapshot.questions.some((q) => q.id === questionId);
  if (!questionExists) {
    throw new Error(`Question with ID '${questionId}' does not belong to this examination.`);
  }

  if (answerIndex !== null && answerIndex !== undefined) {
    const idx = Number(answerIndex);
    if (isNaN(idx) || idx < 0 || idx > 3) {
      throw new Error("Answer index must be between 0 and 3.");
    }
    activeAttempt.answers[questionId] = idx;
  } else {
    delete activeAttempt.answers[questionId];
  }

  // Update checkpoint asynchronously
  checkpointActiveAttempt();

  return { success: true, answers: activeAttempt.answers };
}

/**
 * Toggles or sets the Marked-for-Review state for a question.
 */
function markForReview(questionId, marked) {
  if (!isExamActive()) {
    throw new Error("No active examination attempt in progress.");
  }

  const questionExists = activeAttempt.examSnapshot.questions.some((q) => q.id === questionId);
  if (!questionExists) {
    throw new Error(`Question with ID '${questionId}' does not belong to this examination.`);
  }

  const currentMarks = new Set(activeAttempt.markedForReview);

  if (marked) {
    currentMarks.add(questionId);
  } else {
    currentMarks.delete(questionId);
  }

  activeAttempt.markedForReview = Array.from(currentMarks);

  // Update checkpoint asynchronously
  checkpointActiveAttempt();

  return { success: true, markedForReview: activeAttempt.markedForReview };
}

/**
 * Submits and finalizes the active examination.
 * Performs idempotent calculation of results and reveals answer review.
 */
async function submitExam(submissionType = "manual") {
  // Idempotency check: if not in progress, return latest result
  if (!isExamActive()) {
    if (latestFinalizedAttempt && latestFinalizedAttempt.result) {
      return latestFinalizedAttempt.result;
    }
    throw new Error("No active examination attempt found to submit.");
  }

  // Stop authoritative timer & stop monitoring
  timerService.stopTimer();
  const monitoringFinal = monitoringService.stopMonitoring();

  const nowIso = new Date().toISOString();
  activeAttempt.endedAt = nowIso;
  activeAttempt.status = submissionType === "auto" ? "auto_submitted" : "submitted";

  // Record submission event
  const submitEventType = submissionType === "auto" ? "EXAM_AUTO_SUBMITTED" : "EXAM_SUBMITTED";
  const submitReason = submissionType === "auto"
    ? "Examination countdown timer expired. System automatically finalized the exam."
    : "Candidate manually confirmed and submitted the examination.";

  monitoringFinal.events.push({
    id: "event-" + crypto.randomUUID(),
    type: submitEventType,
    timestamp: nowIso,
    reason: submitReason,
    metadata: {}
  });

  let score = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  const answerReview = [];

  for (const q of activeAttempt.examSnapshot.questions) {
    const selected = activeAttempt.answers[q.id];
    const isAnswered = selected !== undefined && selected !== null;
    const isCorrect = isAnswered && Number(selected) === Number(q.correctAnswer);

    if (!isAnswered) {
      unansweredCount++;
    } else if (isCorrect) {
      score++;
      correctCount++;
    } else {
      incorrectCount++;
    }

    // Only revealed after submission
    answerReview.push({
      questionId: q.id,
      text: q.text,
      options: q.options,
      selectedAnswer: isAnswered ? Number(selected) : null,
      correctAnswer: q.correctAnswer,
      isCorrect,
      explanation: q.explanation || ""
    });
  }

  const totalQuestions = activeAttempt.examSnapshot.questions.length;
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const timeUsedMs = Math.max(0, new Date(activeAttempt.endedAt).getTime() - new Date(activeAttempt.startedAt).getTime());

  const result = {
    attemptId: activeAttempt.id,
    examId: activeAttempt.examId,
    examTitle: activeAttempt.examSnapshot.title,
    subject: activeAttempt.examSnapshot.subject,
    candidateName: activeAttempt.candidateName,
    startedAt: activeAttempt.startedAt,
    endedAt: activeAttempt.endedAt,
    submissionType: activeAttempt.status,
    totalQuestions,
    answeredCount: totalQuestions - unansweredCount,
    unansweredCount,
    correctCount,
    incorrectCount,
    score,
    percentage,
    timeUsedMs,
    answerReview,
    monitoringSummary: monitoringFinal.summary,
    monitoringEvents: monitoringFinal.events
  };

  activeAttempt.result = result;
  latestFinalizedAttempt = { ...activeAttempt };

  // Phase 5: Persist finalized attempt to attempts.json atomically
  try {
    const attempts = storageService.readJsonFile(ATTEMPTS_FILE, []);
    if (!attempts.some((a) => a.id === latestFinalizedAttempt.id)) {
      attempts.push(latestFinalizedAttempt);
      await storageService.writeJsonFile(ATTEMPTS_FILE, attempts);
    }
    // Delete in-progress checkpoint
    storageService.deleteFile(ACTIVE_ATTEMPT_FILE);
  } catch (err) {
    console.error("[ExamService] Failed to persist attempt to attempts.json:", err);
  }

  activeAttempt = null; // Clear active attempt state

  // Trigger native desktop notification
  const notifTitle = submissionType === "auto" ? "ExamTrace — Time Expired" : "ExamTrace — Exam Submitted";
  const notifBody = submissionType === "auto"
    ? `Examination deadline expired. Final score: ${score}/${totalQuestions} (${percentage}%)`
    : `Submitted successfully! Final score: ${score}/${totalQuestions} (${percentage}%)`;
  notificationService.showNotification(notifTitle, notifBody);

  // Broadcast completion to all open windows (useful for timeout auto-submit)
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send("exam:completed", result);
    }
  }

  return result;
}

/**
 * Gets the most recently finalized exam result (for report viewing).
 */
function getLatestResult() {
  return latestFinalizedAttempt ? latestFinalizedAttempt.result : null;
}

// ==========================================
// PHASE 5: DURABLE HISTORY & RESTART RECOVERY
// ==========================================

/**
 * Restores an unfinished attempt after an application restart,
 * or finalizes it once as auto_submitted if the deadline expired while closed.
 */
async function restoreActiveAttemptOrFinalize() {
  if (!storageService.fileExists(ACTIVE_ATTEMPT_FILE)) {
    return null;
  }

  let checkpoint;
  try {
    checkpoint = storageService.readJsonFile(ACTIVE_ATTEMPT_FILE);
  } catch (err) {
    console.error("[ExamService] Corrupted active attempt checkpoint:", err);
    storageService.deleteFile(ACTIVE_ATTEMPT_FILE);
    return null;
  }

  if (!checkpoint || !checkpoint.deadline || checkpoint.status !== "in_progress") {
    storageService.deleteFile(ACTIVE_ATTEMPT_FILE);
    return null;
  }

  const deadlineMs = new Date(checkpoint.deadline).getTime();
  const now = Date.now();

  // Scenario A: Deadline expired while application was closed
  if (now >= deadlineMs) {
    console.log("[ExamService] Recovering expired attempt from restart. Finalizing as auto_submitted...");

    let score = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    const answerReview = [];

    for (const q of checkpoint.examSnapshot.questions) {
      const selected = checkpoint.answers ? checkpoint.answers[q.id] : undefined;
      const isAnswered = selected !== undefined && selected !== null;
      const isCorrect = isAnswered && Number(selected) === Number(q.correctAnswer);

      if (!isAnswered) {
        unansweredCount++;
      } else if (isCorrect) {
        score++;
        correctCount++;
      } else {
        incorrectCount++;
      }

      answerReview.push({
        questionId: q.id,
        text: q.text,
        options: q.options,
        selectedAnswer: isAnswered ? Number(selected) : null,
        correctAnswer: q.correctAnswer,
        isCorrect,
        explanation: q.explanation || ""
      });
    }

    const totalQuestions = checkpoint.examSnapshot.questions.length;
    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    const timeUsedMs = Math.max(0, deadlineMs - new Date(checkpoint.startedAt).getTime());

    // Factual closure event without inventing gap activity
    const finalEvents = Array.isArray(checkpoint.events) ? [...checkpoint.events] : [];
    finalEvents.push({
      id: "event-" + crypto.randomUUID(),
      type: "APPLICATION_CLOSED_EXPIRATION",
      timestamp: checkpoint.deadline,
      reason: "Examination deadline expired while application was closed. Finalized upon reopening.",
      metadata: {}
    });

    const focusCount = finalEvents.filter((e) => e.type === "WINDOW_BLUR").length;
    const fsExitCount = finalEvents.filter((e) => e.type === "FULLSCREEN_EXIT").length;
    const idleCount = finalEvents.filter((e) => e.type === "SYSTEM_IDLE").length;

    const result = {
      attemptId: checkpoint.id,
      examId: checkpoint.examId,
      examTitle: checkpoint.examSnapshot.title,
      subject: checkpoint.examSnapshot.subject,
      candidateName: checkpoint.candidateName,
      startedAt: checkpoint.startedAt,
      endedAt: checkpoint.deadline,
      submissionType: "auto_submitted",
      totalQuestions,
      answeredCount: totalQuestions - unansweredCount,
      unansweredCount,
      correctCount,
      incorrectCount,
      score,
      percentage,
      timeUsedMs,
      answerReview,
      monitoringSummary: {
        totalEventsCount: finalEvents.length,
        focusDeparturesCount: focusCount,
        fullscreenExitsCount: fsExitCount,
        idleEventsCount: idleCount,
        totalUnfocusedTimeMs: 0,
        totalUnfocusedTimeSeconds: 0,
        totalIdleTimeMs: 0,
        totalIdleTimeSeconds: 0
      },
      monitoringEvents: finalEvents
    };

    const finalizedRecord = {
      ...checkpoint,
      endedAt: checkpoint.deadline,
      status: "auto_submitted",
      result
    };

    const attempts = storageService.readJsonFile(ATTEMPTS_FILE, []);
    if (!attempts.some((a) => a.id === finalizedRecord.id)) {
      attempts.push(finalizedRecord);
      await storageService.writeJsonFile(ATTEMPTS_FILE, attempts);
    }

    storageService.deleteFile(ACTIVE_ATTEMPT_FILE);
    latestFinalizedAttempt = finalizedRecord;
    return result;
  }

  // Scenario B: Deadline is still valid!
  console.log(`[ExamService] Restoring valid active exam from checkpoint: ${checkpoint.id}`);
  activeAttempt = checkpoint;

  // Restart authoritative countdown
  timerService.startTimer(deadlineMs, async () => {
    console.log("[ExamService] Restored exam deadline expired. Finalizing auto-submit...");
    try {
      await submitExam("auto");
    } catch (err) {
      console.error("[ExamService] Error during auto-submit of restored attempt:", err);
    }
  });

  // Resume monitoring
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (win) {
    monitoringService.startMonitoring(win);
  }

  return getActiveExam();
}

/**
 * Gets shared local examination history.
 */
function getExamHistory() {
  const attempts = storageService.readJsonFile(ATTEMPTS_FILE, []);
  if (!Array.isArray(attempts)) return [];

  return attempts
    .map((attempt) => {
      const res = attempt.result || {};
      return {
        id: attempt.id,
        examId: attempt.examId,
        examTitle: res.examTitle || (attempt.examSnapshot && attempt.examSnapshot.title) || "Examination",
        subject: res.subject || (attempt.examSnapshot && attempt.examSnapshot.subject) || "General",
        candidateName: attempt.candidateName || "Candidate",
        startedAt: attempt.startedAt,
        endedAt: attempt.endedAt,
        score: res.score !== undefined ? res.score : 0,
        totalQuestions: res.totalQuestions || 0,
        percentage: res.percentage !== undefined ? res.percentage : 0,
        submissionType: attempt.status || "submitted",
        eventsCount: (res.monitoringEvents && res.monitoringEvents.length) || 0
      };
    })
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

/**
 * Fetches an attempt report using its frozen historical snapshot.
 */
function getExamReport(attemptId) {
  if (latestFinalizedAttempt && latestFinalizedAttempt.id === attemptId && latestFinalizedAttempt.result) {
    return latestFinalizedAttempt.result;
  }

  const attempts = storageService.readJsonFile(ATTEMPTS_FILE, []);
  const found = attempts.find((a) => a.id === attemptId);

  if (!found) {
    throw new Error(`Examination attempt with ID '${attemptId}' not found.`);
  }

  return found.result || found;
}

/**
 * Calculates aggregate class performance and monitoring statistics.
 * Protected by Main-process authorization.
 */
function getAnalytics() {
  if (!authService.isExaminerUnlocked()) {
    throw new Error("Unauthorized: Examiner Mode must be unlocked to view performance analytics.");
  }

  const attempts = storageService.readJsonFile(ATTEMPTS_FILE, []);

  if (!Array.isArray(attempts) || attempts.length === 0) {
    return {
      totalAttempts: 0,
      averageScore: 0,
      averagePercentage: 0,
      highestScore: 0,
      lowestScore: 0,
      passCount: 0,
      failCount: 0,
      passRate: 0,
      totalFocusDepartures: 0,
      totalFullscreenExits: 0,
      totalIdleEvents: 0,
      distribution: [
        { label: "0-20%", count: 0 },
        { label: "21-40%", count: 0 },
        { label: "41-60%", count: 0 },
        { label: "61-80%", count: 0 },
        { label: "81-100%", count: 0 }
      ],
      recentAttempts: []
    };
  }

  const totalAttempts = attempts.length;
  let totalScore = 0;
  let totalPercentage = 0;
  let highestScore = -Infinity;
  let lowestScore = Infinity;
  let passCount = 0;

  let totalFocusDepartures = 0;
  let totalFullscreenExits = 0;
  let totalIdleEvents = 0;

  const distribution = [
    { label: "0-20%", count: 0 },
    { label: "21-40%", count: 0 },
    { label: "41-60%", count: 0 },
    { label: "61-80%", count: 0 },
    { label: "81-100%", count: 0 }
  ];

  for (const a of attempts) {
    const res = a.result || {};
    const sc = res.score !== undefined ? Number(res.score) : 0;
    const pct = res.percentage !== undefined ? Number(res.percentage) : 0;

    totalScore += sc;
    totalPercentage += pct;

    if (sc > highestScore) highestScore = sc;
    if (sc < lowestScore) lowestScore = sc;

    if (pct >= 60) {
      passCount++;
    }

    if (pct <= 20) distribution[0].count++;
    else if (pct <= 40) distribution[1].count++;
    else if (pct <= 60) distribution[2].count++;
    else if (pct <= 80) distribution[3].count++;
    else distribution[4].count++;

    const mSum = res.monitoringSummary || {};
    totalFocusDepartures += mSum.focusDeparturesCount || 0;
    totalFullscreenExits += mSum.fullscreenExitsCount || 0;
    totalIdleEvents += mSum.idleEventsCount || 0;
  }

  const averageScore = Number((totalScore / totalAttempts).toFixed(1));
  const averagePercentage = Math.round(totalPercentage / totalAttempts);
  const passRate = Math.round((passCount / totalAttempts) * 100);

  const recentAttempts = attempts
    .map((a) => {
      const r = a.result || {};
      return {
        id: a.id,
        candidateName: a.candidateName || "Candidate",
        examTitle: r.examTitle || (a.examSnapshot && a.examSnapshot.title) || "Examination",
        score: r.score !== undefined ? r.score : 0,
        totalQuestions: r.totalQuestions || 0,
        percentage: r.percentage !== undefined ? r.percentage : 0,
        startedAt: a.startedAt
      };
    })
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 5);

  return {
    totalAttempts,
    averageScore,
    averagePercentage,
    highestScore: highestScore === -Infinity ? 0 : highestScore,
    lowestScore: lowestScore === Infinity ? 0 : lowestScore,
    passCount,
    failCount: totalAttempts - passCount,
    passRate,
    totalFocusDepartures,
    totalFullscreenExits,
    totalIdleEvents,
    distribution,
    recentAttempts
  };
}

module.exports = {
  initializeData,
  sanitizeQuestionsForCandidate,
  isExamActive,
  getAvailableExams,
  getExamForEditing,
  getInternalExamById,
  saveExam,
  deleteExam,
  startExam,
  getActiveExam,
  saveAnswer,
  markForReview,
  submitExam,
  getLatestResult,
  restoreActiveAttemptOrFinalize,
  getExamHistory,
  getExamReport,
  getAnalytics
};
