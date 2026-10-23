// electron/preload.cjs
// Sandboxed preload script
// Securely bridges the Main Process to the Renderer Process via contextBridge.

const { contextBridge, ipcRenderer } = require("electron");

// Expose a narrow, strictly typed API to the global window object
contextBridge.exposeInMainWorld("examTrace", {
  // Phase 1: IPC Connectivity & System Information
  ping: () => ipcRenderer.invoke("app:ping")
});
