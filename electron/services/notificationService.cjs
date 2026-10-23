// electron/services/notificationService.cjs
// Manages native desktop operating system notifications via Electron Notification API.

const { Notification } = require("electron");

/**
 * Displays a native desktop notification if supported on the current platform.
 */
function showNotification(title, body) {
  try {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: title || "ExamTrace",
        body: body || "",
        silent: false
      });
      notification.show();
    } else {
      console.log(`[NotificationService] Native notifications not supported: [${title}] ${body}`);
    }
  } catch (err) {
    console.error("[NotificationService] Failed to display native notification:", err);
  }
}

module.exports = {
  showNotification
};
