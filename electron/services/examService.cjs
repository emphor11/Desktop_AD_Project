// electron/services/examService.cjs
// Handles examination management (CRUD), initial sample exam seeding,
// input validation, and answer key sanitization for candidates.

const crypto = require("crypto");
const storageService = require("./storageService.cjs");
const authService = require("./authService.cjs");

const EXAMS_FILE = "exams.json";
const INIT_FILE = "app-init.json";

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

    // If exams file doesn't exist, seed the sample exam
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

    // Write initialization marker so we never recreate deleted sample exams
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
      createdAt: exam.createdAt
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
 * Used internally by Main process during exam execution and grading.
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
 * Protected by Main process authorization.
 */
async function saveExam(examData) {
  if (!authService.isExaminerUnlocked()) {
    throw new Error("Unauthorized: Examiner Mode must be unlocked to save an examination.");
  }

  validateExamData(examData);

  const exams = storageService.readJsonFile(EXAMS_FILE, []);
  const now = new Date().toISOString();

  // Clean and prepare questions
  const sanitizedQuestions = examData.questions.map((q) => ({
    id: q.id || crypto.randomUUID(),
    text: q.text.trim(),
    options: q.options.map((opt) => opt.trim()),
    correctAnswer: Number(q.correctAnswer),
    explanation: (q.explanation || "").trim()
  }));

  let savedExam;

  if (examData.id) {
    // Update existing
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
    // Create new
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
 * Protected by Main process authorization.
 * Note: Historical attempts are preserved in attempts.json.
 */
async function deleteExam(examId) {
  if (!authService.isExaminerUnlocked()) {
    throw new Error("Unauthorized: Examiner Mode must be unlocked to delete an examination.");
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

module.exports = {
  initializeData,
  sanitizeQuestionsForCandidate,
  getAvailableExams,
  getExamForEditing,
  getInternalExamById,
  saveExam,
  deleteExam
};
