// electron/main.cjs
// Main Process for ExamTrace
// Responsible for application lifecycle, native windows, and secure IPC communication.

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

// Ensure the application identity is set consistently before querying paths
app.name = "ExamTrace";

// Determine if we are running in development mode
const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "ExamTrace",
    width: 1200,
    height: 800,
    minWidth: 950,
    minHeight: 650,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDev // DevTools enabled only in development
    }
  });

  // Verify and log user data path for debugging and validation
  const userDataPath = app.getPath("userData");
  console.log(`[ExamTrace] Application Data Directory: ${userDataPath}`);

  // Load Vite dev server URL in development, or packaged index.html in production
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Register basic ping IPC handler to verify Main <-> Renderer communication
ipcMain.handle("app:ping", async () => {
  return {
    appName: app.name,
    productName: "ExamTrace",
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    platform: process.platform,
    userDataPath: app.getPath("userData"),
    timestamp: new Date().toISOString()
  };
});

// Application lifecycle management
app.whenReady().then(() => {
  createWindow();

  // macOS standard behavior: recreate a window when dock icon is clicked
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS where applications commonly stay active
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
