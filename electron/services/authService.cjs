// electron/services/authService.cjs
// Manages examiner authentication, passcode hashing with scrypt and salt,
// constant-time verification, and Main-process authorization status.

const crypto = require("crypto");
const storageService = require("./storageService.cjs");

const AUTH_FILE = "examiner-auth.json";
const INIT_FILE = "app-init.json";
const SCRYPT_KEY_LEN = 64;

// In-memory authorization state (reset on app launch)
let examinerUnlocked = false;
let failedAttempts = 0;

/**
 * Checks if a missing auth file constitutes a recovery condition.
 * A recovery error is triggered if auth is missing BUT:
 * 1. An earlier initial setup was completed (firstRunSetupCompleted = true).
 * 2. Attempts history exists (attempts.json or active-attempt.json).
 * 3. User-created exams exist (exams beyond the initial sample exam).
 */
function isRecoveryCondition() {
  const initData = storageService.readJsonFile(INIT_FILE, null);

  // If setup was completed in a previous session but auth file is gone
  if (initData && initData.firstRunSetupCompleted) {
    return true;
  }

  // If exam attempts exist
  if (storageService.fileExists("attempts.json") || storageService.fileExists("active-attempt.json")) {
    return true;
  }

  // If any user-created exam exists
  const exams = storageService.readJsonFile("exams.json", []);
  if (Array.isArray(exams) && exams.some((e) => !e.isSample)) {
    return true;
  }

  return false;
}

/**
 * Derives a key using crypto.scrypt as a Promise.
 */
function deriveScryptKey(passcode, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(passcode, salt, SCRYPT_KEY_LEN, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey);
    });
  });
}

/**
 * Checks the status of examiner configuration.
 * Returns: { isConfigured, isUnlocked, recoveryRequired, errorMessage }
 */
function getExaminerStatus() {
  const authExists = storageService.fileExists(AUTH_FILE);

  if (authExists) {
    try {
      const authData = storageService.readJsonFile(AUTH_FILE);
      if (authData && authData.examinerAuth && authData.examinerAuth.salt && authData.examinerAuth.passwordHash) {
        return {
          isConfigured: true,
          isUnlocked: examinerUnlocked,
          recoveryRequired: false,
          errorMessage: null
        };
      }
    } catch (err) {
      return {
        isConfigured: false,
        isUnlocked: false,
        recoveryRequired: true,
        errorMessage: `Authentication file corrupted: ${err.message}`
      };
    }
  }

  // If examiner-auth.json is missing, check if this is an unauthorized missing-file scenario
  if (isRecoveryCondition()) {
    return {
      isConfigured: false,
      isUnlocked: false,
      recoveryRequired: true,
      errorMessage: "Authentication recovery error: Existing application data found but examiner authentication is missing. Passcode setup cannot overwrite existing data."
    };
  }

  // Genuinely fresh installation
  return {
    isConfigured: false,
    isUnlocked: false,
    recoveryRequired: false,
    errorMessage: null
  };
}

/**
 * Performs first-time setup for the examiner passcode.
 */
async function setupExaminer(passcode) {
  const status = getExaminerStatus();

  if (status.isConfigured) {
    throw new Error("Examiner passcode is already configured. Cannot re-initialize.");
  }

  if (status.recoveryRequired) {
    throw new Error(status.errorMessage || "Cannot setup passcode: Application is in recovery mode.");
  }

  if (!passcode || typeof passcode !== "string" || passcode.trim().length < 6) {
    throw new Error("Passcode must be at least 6 characters long.");
  }

  // Generate a cryptographically secure random salt
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await deriveScryptKey(passcode.trim(), salt);

  const authData = {
    examinerAuth: {
      salt,
      passwordHash: derivedKey.toString("hex"),
      createdAt: new Date().toISOString()
    }
  };

  // Atomically persist examiner authentication data
  await storageService.writeJsonFile(AUTH_FILE, authData);

  // Mark initial setup as completed in app-init.json
  const initData = storageService.readJsonFile(INIT_FILE, {});
  await storageService.writeJsonFile(INIT_FILE, {
    ...initData,
    firstRunSetupCompleted: true,
    setupCompletedAt: new Date().toISOString()
  });

  return { success: true, message: "Examiner passcode configured successfully." };
}

/**
 * Verifies an entered passcode and unlocks Examiner Mode on success.
 */
async function unlockExaminer(passcode) {
  const status = getExaminerStatus();

  if (!status.isConfigured) {
    throw new Error(status.errorMessage || "Examiner authentication has not been configured.");
  }

  if (!passcode || typeof passcode !== "string") {
    throw new Error("Passcode cannot be empty.");
  }

  // Simple attempt limiting / progressive delay to mitigate brute force
  if (failedAttempts > 0) {
    const delayMs = Math.min(failedAttempts * 300, 2000);
    await new Promise((r) => setTimeout(r, delayMs));
  }

  const authData = storageService.readJsonFile(AUTH_FILE);
  const { salt, passwordHash } = authData.examinerAuth;

  const storedBuffer = Buffer.from(passwordHash, "hex");
  const candidateBuffer = await deriveScryptKey(passcode.trim(), salt);

  // Validate buffer lengths before timingSafeEqual to avoid throwing length mismatch errors
  if (storedBuffer.length !== candidateBuffer.length) {
    failedAttempts++;
    throw new Error("Invalid examiner passcode.");
  }

  const isMatch = crypto.timingSafeEqual(storedBuffer, candidateBuffer);

  if (!isMatch) {
    failedAttempts++;
    throw new Error("Invalid examiner passcode.");
  }

  // Success: reset failed attempt counter and set authorized flag
  failedAttempts = 0;
  examinerUnlocked = true;

  return { success: true, message: "Examiner Mode unlocked." };
}

/**
 * Locks Examiner Mode and revokes privileges.
 */
function lockExaminer() {
  examinerUnlocked = false;
  return { success: true, message: "Examiner Mode locked." };
}

/**
 * Checks if the caller is currently authorized as examiner.
 */
function isExaminerUnlocked() {
  return examinerUnlocked;
}

/**
 * Changes the examiner passcode. Requires current unlock state and verification.
 */
async function changeExaminerPasscode(currentPasscode, newPasscode) {
  if (!examinerUnlocked) {
    throw new Error("Unauthorized: Examiner Mode must be unlocked to change passcode.");
  }

  if (!newPasscode || typeof newPasscode !== "string" || newPasscode.trim().length < 6) {
    throw new Error("New passcode must be at least 6 characters long.");
  }

  // Verify current passcode before changing
  const authData = storageService.readJsonFile(AUTH_FILE);
  const { salt, passwordHash } = authData.examinerAuth;

  const storedBuffer = Buffer.from(passwordHash, "hex");
  const candidateBuffer = await deriveScryptKey(currentPasscode.trim(), salt);

  if (storedBuffer.length !== candidateBuffer.length || !crypto.timingSafeEqual(storedBuffer, candidateBuffer)) {
    throw new Error("Current passcode is incorrect.");
  }

  // Generate new salt and hash for new passcode
  const newSalt = crypto.randomBytes(16).toString("hex");
  const newDerivedKey = await deriveScryptKey(newPasscode.trim(), newSalt);

  const updatedAuthData = {
    examinerAuth: {
      salt: newSalt,
      passwordHash: newDerivedKey.toString("hex"),
      updatedAt: new Date().toISOString()
    }
  };

  await storageService.writeJsonFile(AUTH_FILE, updatedAuthData);

  return { success: true, message: "Passcode updated successfully." };
}

module.exports = {
  getExaminerStatus,
  setupExaminer,
  unlockExaminer,
  lockExaminer,
  isExaminerUnlocked,
  changeExaminerPasscode
};
