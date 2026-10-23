// electron/services/monitoringService.cjs
// Manages real-time desktop activity monitoring during active examinations.
// Tracks BrowserWindow focus/blur/minimize/restore, fullscreen state,
// and powerMonitor idle/lock/sleep state without false duplicate violations.

const crypto = require("crypto");
const { powerMonitor, BrowserWindow } = require("electron");

let isMonitoringActive = false;
let boundWindow = null;
let boundListeners = {};

// In-memory state tracking to prevent duplicate departure intervals
let isWindowUnfocused = false;
let unfocusedSince = null;
let isSystemIdle = false;
let idleSince = null;

let totalUnfocusedTimeMs = 0;
let totalIdleTimeMs = 0;
let events = [];

let idleCheckInterval = null;
let isDemoMode = false;
const DEFAULT_IDLE_THRESHOLD_SECONDS = 60;
const DEMO_IDLE_THRESHOLD_SECONDS = 10;

/**
 * Gets the active idle threshold in seconds.
 */
function getIdleThresholdSeconds() {
  return isDemoMode ? DEMO_IDLE_THRESHOLD_SECONDS : DEFAULT_IDLE_THRESHOLD_SECONDS;
}

/**
 * Sets Demo Mode (lowers idle threshold to 10s for live viva demonstration).
 */
function setDemoMode(enabled) {
  isDemoMode = !!enabled;
  console.log(`[MonitoringService] Demo Mode ${isDemoMode ? "ENABLED (10s threshold)" : "DISABLED (60s threshold)"}`);
  return { success: true, isDemoMode };
}

function getDemoMode() {
  return isDemoMode;
}

/**
 * Records a monitoring event in the chronological timeline and broadcasts it to renderer.
 */
function recordEvent(type, reason, metadata = {}) {
  const eventObj = {
    id: "event-" + crypto.randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    reason,
    metadata
  };

  events.push(eventObj);

  // Broadcast to all open BrowserWindows
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send("monitoring:event", eventObj);
    }
  }

  return eventObj;
}

/**
 * Starts monitoring for an active window.
 */
function startMonitoring(targetWindow) {
  stopMonitoring(); // Ensure clean slate

  isMonitoringActive = true;
  boundWindow = targetWindow;
  events = [];
  totalUnfocusedTimeMs = 0;
  totalIdleTimeMs = 0;
  isWindowUnfocused = false;
  unfocusedSince = null;
  isSystemIdle = false;
  idleSince = null;

  recordEvent("EXAM_STARTED", "Candidate initiated the examination workspace.");

  if (!targetWindow || targetWindow.isDestroyed()) return;

  // 1. Window Blur (Lost Focus)
  boundListeners.blur = () => {
    if (!isMonitoringActive) return;
    if (!isWindowUnfocused) {
      isWindowUnfocused = true;
      unfocusedSince = Date.now();
      recordEvent("WINDOW_BLUR", "Examination window lost focus (switched application or clicked outside).");
    }
  };

  // 2. Window Minimize
  boundListeners.minimize = () => {
    if (!isMonitoringActive) return;
    recordEvent("WINDOW_MINIMIZED", "Examination window minimized.");
    if (!isWindowUnfocused) {
      isWindowUnfocused = true;
      unfocusedSince = Date.now();
    }
  };

  // 3. Window Restore
  boundListeners.restore = () => {
    if (!isMonitoringActive) return;
    recordEvent("WINDOW_RESTORED", "Examination window restored from minimized state.");
  };

  // 4. Window Focus (Regained Focus)
  boundListeners.focus = () => {
    if (!isMonitoringActive) return;
    if (isWindowUnfocused) {
      const elapsed = unfocusedSince ? Math.max(0, Date.now() - unfocusedSince) : 0;
      totalUnfocusedTimeMs += elapsed;
      isWindowUnfocused = false;
      unfocusedSince = null;

      recordEvent("WINDOW_FOCUS", "Examination window regained active focus.", {
        durationAwayMs: elapsed,
        durationAwaySeconds: Math.round(elapsed / 1000)
      });
    }
  };

  // 5. Fullscreen Events
  boundListeners.enterFullScreen = () => {
    if (!isMonitoringActive) return;
    recordEvent("FULLSCREEN_ENTER", "Examination entered fullscreen mode.");
  };

  boundListeners.leaveFullScreen = () => {
    if (!isMonitoringActive) return;
    recordEvent("FULLSCREEN_EXIT", "Examination exited fullscreen mode.");
    if (boundWindow && !boundWindow.isDestroyed()) {
      boundWindow.webContents.send("monitoring:fullscreenWarning", {
        message: "Fullscreen exit detected. Please return to fullscreen mode."
      });
    }
  };

  // Attach BrowserWindow event listeners
  targetWindow.on("blur", boundListeners.blur);
  targetWindow.on("minimize", boundListeners.minimize);
  targetWindow.on("restore", boundListeners.restore);
  targetWindow.on("focus", boundListeners.focus);
  targetWindow.on("enter-full-screen", boundListeners.enterFullScreen);
  targetWindow.on("leave-full-screen", boundListeners.leaveFullScreen);

  // 6. powerMonitor Idle Polling
  const thresholdSec = getIdleThresholdSeconds();
  idleCheckInterval = setInterval(() => {
    if (!isMonitoringActive) return;

    try {
      const currentIdleSec = powerMonitor.getSystemIdleTime();
      const currentThreshold = getIdleThresholdSeconds();

      if (currentIdleSec >= currentThreshold && !isSystemIdle) {
        isSystemIdle = true;
        idleSince = Date.now();
        recordEvent("SYSTEM_IDLE", `System inactivity detected (${currentIdleSec}s without keyboard/mouse input).`, {
          thresholdSeconds: currentThreshold,
          idleSeconds: currentIdleSec
        });
      } else if (currentIdleSec < currentThreshold && isSystemIdle) {
        const elapsed = idleSince ? Math.max(0, Date.now() - idleSince) : 0;
        totalIdleTimeMs += elapsed;
        isSystemIdle = false;
        idleSince = null;
        recordEvent("SYSTEM_ACTIVE", "System activity resumed.", {
          idleDurationMs: elapsed,
          idleDurationSeconds: Math.round(elapsed / 1000)
        });
      }
    } catch (err) {
      // Graceful fallback if powerMonitor is unsupported
    }
  }, 1000);

  // 7. powerMonitor Lock & Suspend listeners
  try {
    boundListeners.lockScreen = () => {
      if (isMonitoringActive) recordEvent("SYSTEM_LOCKED", "Operating system screen locked.");
    };
    boundListeners.unlockScreen = () => {
      if (isMonitoringActive) recordEvent("SYSTEM_UNLOCKED", "Operating system screen unlocked.");
    };
    boundListeners.suspend = () => {
      if (isMonitoringActive) recordEvent("SYSTEM_SUSPENDED", "Operating system entered sleep/suspend mode.");
    };
    boundListeners.resume = () => {
      if (isMonitoringActive) recordEvent("SYSTEM_RESUMED", "Operating system resumed from sleep/suspend mode.");
    };

    powerMonitor.on("lock-screen", boundListeners.lockScreen);
    powerMonitor.on("unlock-screen", boundListeners.unlockScreen);
    powerMonitor.on("suspend", boundListeners.suspend);
    powerMonitor.on("resume", boundListeners.resume);
  } catch (_) {
    // Unsupported platform events degrade gracefully
  }
}

/**
 * Stops monitoring and cleanly closes any open unfocused/idle intervals.
 */
function stopMonitoring() {
  if (!isMonitoringActive) return { events: [], summary: null };

  const now = Date.now();

  // Close open unfocused interval (e.g. submission while unfocused)
  if (isWindowUnfocused && unfocusedSince) {
    const elapsed = Math.max(0, now - unfocusedSince);
    totalUnfocusedTimeMs += elapsed;
    isWindowUnfocused = false;
    unfocusedSince = null;
  }

  // Close open idle interval
  if (isSystemIdle && idleSince) {
    const elapsed = Math.max(0, now - idleSince);
    totalIdleTimeMs += elapsed;
    isSystemIdle = false;
    idleSince = null;
  }

  // Clean up window listeners
  if (boundWindow && !boundWindow.isDestroyed()) {
    if (boundListeners.blur) boundWindow.removeListener("blur", boundListeners.blur);
    if (boundListeners.minimize) boundWindow.removeListener("minimize", boundListeners.minimize);
    if (boundListeners.restore) boundWindow.removeListener("restore", boundListeners.restore);
    if (boundListeners.focus) boundWindow.removeListener("focus", boundListeners.focus);
    if (boundListeners.enterFullScreen) boundWindow.removeListener("enter-full-screen", boundListeners.enterFullScreen);
    if (boundListeners.leaveFullScreen) boundWindow.removeListener("leave-full-screen", boundListeners.leaveFullScreen);
  }

  // Clean up powerMonitor
  if (idleCheckInterval) {
    clearInterval(idleCheckInterval);
    idleCheckInterval = null;
  }

  try {
    if (boundListeners.lockScreen) powerMonitor.removeListener("lock-screen", boundListeners.lockScreen);
    if (boundListeners.unlockScreen) powerMonitor.removeListener("unlock-screen", boundListeners.unlockScreen);
    if (boundListeners.suspend) powerMonitor.removeListener("suspend", boundListeners.suspend);
    if (boundListeners.resume) powerMonitor.removeListener("resume", boundListeners.resume);
  } catch (_) {}

  isMonitoringActive = false;
  boundWindow = null;
  boundListeners = {};

  // Compute final summary metrics
  const focusDeparturesCount = events.filter((e) => e.type === "WINDOW_BLUR").length;
  const fullscreenExitsCount = events.filter((e) => e.type === "FULLSCREEN_EXIT").length;
  const idleEventsCount = events.filter((e) => e.type === "SYSTEM_IDLE").length;

  const summary = {
    totalEventsCount: events.length,
    focusDeparturesCount,
    fullscreenExitsCount,
    idleEventsCount,
    totalUnfocusedTimeMs,
    totalUnfocusedTimeSeconds: Math.round(totalUnfocusedTimeMs / 1000),
    totalIdleTimeMs,
    totalIdleTimeSeconds: Math.round(totalIdleTimeMs / 1000)
  };

  return {
    events: [...events],
    summary
  };
}

/**
 * Returns current event log and state for active attempt.
 */
function getCurrentMonitoringState() {
  return {
    isMonitoringActive,
    isWindowUnfocused,
    isSystemIdle,
    isDemoMode,
    idleThresholdSeconds: getIdleThresholdSeconds(),
    eventCount: events.length,
    events: [...events]
  };
}

module.exports = {
  startMonitoring,
  stopMonitoring,
  recordEvent,
  setDemoMode,
  getDemoMode,
  getCurrentMonitoringState
};
