// electron/services/storageService.cjs
// Manages JSON file persistence in app.getPath("userData").
// Implements safe reads, per-file queued atomic writes (write-to-temp + rename), and corruption guards.

const fs = require("fs");
const path = require("path");
const { app } = require("electron");

// Queue map to serialize writes per file path
const writeQueues = new Map();

/**
 * Gets the absolute path for a data file inside userData.
 */
function getDataFilePath(filename) {
  const userDataDir = app.getPath("userData");
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  return path.join(userDataDir, filename);
}

/**
 * Safely reads and parses a JSON file.
 * Returns defaultValue if file does not exist.
 * If file exists but contains invalid JSON, throws a corruption error and creates a backup.
 */
function readJsonFile(filename, defaultValue = null) {
  const filePath = getDataFilePath(filename);

  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }

  const rawData = fs.readFileSync(filePath, "utf-8");

  try {
    return JSON.parse(rawData);
  } catch (parseError) {
    // Preserve corrupted file for recovery instead of silently overwriting
    const backupPath = `${filePath}.corrupt.${Date.now()}`;
    try {
      fs.copyFileSync(filePath, backupPath);
      console.error(`[StorageService] Corrupted JSON in ${filename}. Backup created at: ${backupPath}`);
    } catch (backupError) {
      console.error(`[StorageService] Failed to create backup of corrupted ${filename}:`, backupError);
    }
    throw new Error(`Data file '${filename}' is corrupted and could not be parsed: ${parseError.message}`);
  }
}

/**
 * Atomically writes data to a JSON file using a per-file queue and temp-file rename.
 */
async function writeJsonFile(filename, data) {
  const filePath = getDataFilePath(filename);

  // Initialize or fetch the Promise queue for this file
  let currentQueue = writeQueues.get(filePath) || Promise.resolve();

  // Chain the new write operation onto the queue
  const nextWrite = currentQueue.then(async () => {
    const jsonString = JSON.stringify(data, null, 2);
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`;

    try {
      // 1. Write data to a temporary file
      await fs.promises.writeFile(tempPath, jsonString, "utf-8");
      // 2. Atomically rename temporary file over target file
      await fs.promises.rename(tempPath, filePath);
    } catch (err) {
      // Clean up temp file if write/rename failed
      if (fs.existsSync(tempPath)) {
        try {
          await fs.promises.unlink(tempPath);
        } catch (_) {}
      }
      console.error(`[StorageService] Error writing to ${filename}:`, err);
      throw err;
    }
  });

  // Update writeQueues map to wait for this write
  writeQueues.set(filePath, nextWrite);

  return nextWrite;
}

/**
 * Checks whether any application data files exist.
 */
function hasExistingAppData() {
  const checks = ["exams.json", "attempts.json", "active-attempt.json", "app-init.json"];
  for (const file of checks) {
    const filePath = getDataFilePath(file);
    if (fs.existsSync(filePath)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a specific file exists.
 */
function fileExists(filename) {
  return fs.existsSync(getDataFilePath(filename));
}

/**
 * Safely deletes a file from userData if it exists.
 */
function deleteFile(filename) {
  const filePath = getDataFilePath(filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (err) {
      console.error(`[StorageService] Failed to delete ${filename}:`, err);
      return false;
    }
  }
  return false;
}

module.exports = {
  getDataFilePath,
  readJsonFile,
  writeJsonFile,
  hasExistingAppData,
  fileExists,
  deleteFile
};
