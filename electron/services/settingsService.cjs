// electron/services/settingsService.cjs
// Manages application preferences and protected examiner settings in settings.json.

const storageService = require("./storageService.cjs");
const authService = require("./authService.cjs");
const monitoringService = require("./monitoringService.cjs");

const SETTINGS_FILE = "settings.json";

const DEFAULT_SETTINGS = {
  theme: "dark", // 'dark', 'light', 'system'
  defaultDurationMinutes: 15,
  idleThresholdSeconds: 60,
  demoMode: false,
  enforceFullscreen: true
};

/**
 * Loads current application settings.
 */
function getSettings() {
  const saved = storageService.readJsonFile(SETTINGS_FILE, {});
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    demoMode: monitoringService.getDemoMode()
  };
}

/**
 * Saves application settings with Main process authorization checks.
 * Modifying examiner-only settings requires Examiner Mode to be unlocked.
 */
async function saveSettings(newSettings) {
  if (!newSettings || typeof newSettings !== "object") {
    throw new Error("Invalid settings payload.");
  }

  const current = getSettings();
  const isExaminer = authService.isExaminerUnlocked();

  // If candidate is trying to modify examiner-only settings, reject
  const hasExaminerChanges = (
    (newSettings.defaultDurationMinutes !== undefined && newSettings.defaultDurationMinutes !== current.defaultDurationMinutes) ||
    (newSettings.idleThresholdSeconds !== undefined && newSettings.idleThresholdSeconds !== current.idleThresholdSeconds) ||
    (newSettings.demoMode !== undefined && newSettings.demoMode !== current.demoMode) ||
    (newSettings.enforceFullscreen !== undefined && newSettings.enforceFullscreen !== current.enforceFullscreen)
  );

  if (hasExaminerChanges && !isExaminer) {
    throw new Error("Unauthorized: Examiner Mode must be unlocked to modify monitoring or exam administration preferences.");
  }

  // Update demo mode if specified
  if (newSettings.demoMode !== undefined && isExaminer) {
    monitoringService.setDemoMode(!!newSettings.demoMode);
  }

  const updated = {
    ...current,
    theme: newSettings.theme || current.theme,
    defaultDurationMinutes: isExaminer && newSettings.defaultDurationMinutes ? Number(newSettings.defaultDurationMinutes) : current.defaultDurationMinutes,
    idleThresholdSeconds: isExaminer && newSettings.idleThresholdSeconds ? Number(newSettings.idleThresholdSeconds) : current.idleThresholdSeconds,
    demoMode: isExaminer && newSettings.demoMode !== undefined ? !!newSettings.demoMode : current.demoMode,
    enforceFullscreen: isExaminer && newSettings.enforceFullscreen !== undefined ? !!newSettings.enforceFullscreen : current.enforceFullscreen,
    updatedAt: new Date().toISOString()
  };

  await storageService.writeJsonFile(SETTINGS_FILE, updated);

  return { success: true, settings: updated };
}

module.exports = {
  getSettings,
  saveSettings
};
