// electron/services/timerService.cjs
// Authoritative countdown timer managed strictly by the Electron Main Process.
// Calculates remaining time from deadline - Date.now() to ensure accuracy across sleep/blur/minimize.

const { BrowserWindow } = require("electron");

let timerInterval = null;
let currentDeadline = null;
let onExpireCallback = null;

/**
 * Formats milliseconds into HH:MM:SS.
 */
function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Starts the authoritative timer for an active examination attempt.
 * @param {number} deadlineMs - Epoch milliseconds for the exam deadline
 * @param {Function} onExpire - Callback executed once when the deadline passes
 */
function startTimer(deadlineMs, onExpire) {
  stopTimer();

  currentDeadline = deadlineMs;
  onExpireCallback = onExpire;

  // Run the tick immediately to broadcast initial state
  broadcastTick();

  // Tick every 1 second
  timerInterval = setInterval(() => {
    broadcastTick();
  }, 1000);
}

/**
 * Broadcasts the current remaining time to all active browser windows.
 */
function broadcastTick() {
  if (!currentDeadline) return;

  const now = Date.now();
  const remainingMs = Math.max(0, currentDeadline - now);
  const remainingSeconds = Math.floor(remainingMs / 1000);
  const isExpired = remainingMs <= 0;

  const tickData = {
    remainingMs,
    remainingSeconds,
    formattedTime: formatTime(remainingMs),
    isExpired
  };

  // Broadcast to all BrowserWindows via WebContents
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send("exam:timerTick", tickData);
    }
  }

  // Handle deadline expiration
  if (isExpired) {
    stopTimer();
    if (typeof onExpireCallback === "function") {
      const cb = onExpireCallback;
      onExpireCallback = null;
      cb();
    }
  }
}

/**
 * Stops and clears the active timer.
 */
function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  currentDeadline = null;
  onExpireCallback = null;
}

/**
 * Gets remaining milliseconds based on the current deadline.
 */
function getRemainingMs() {
  if (!currentDeadline) return 0;
  return Math.max(0, currentDeadline - Date.now());
}

module.exports = {
  startTimer,
  stopTimer,
  broadcastTick,
  getRemainingMs,
  formatTime
};
