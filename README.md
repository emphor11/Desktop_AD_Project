# MONITOR — Smart Desktop Examination & Activity Monitoring System (ExamTrace)

A desktop examination and activity monitoring application developed with **Electron.js**, **React.js**, and **Node.js** for the **Application Development** elective.

---

## 📌 Project Overview

**ExamTrace** is designed for academic institutions to administer timed multiple-choice examinations while monitoring desktop activity within a candidate's environment.

### Key Systems
1. **Examination Management:** Secure creation, editing, and deletion of MCQs (Examiner Mode protected via salted `crypto.scrypt` hashing).
2. **Examination Engine:** Timed examinations with an authoritative Main-process countdown timer, question palette, review marking, and automatic submission on deadline.
3. **Desktop Activity Monitoring:** Detects window focus/blur, window minimization, fullscreen exits, and system inactivity using Electron `BrowserWindow` events and `powerMonitor`.
4. **Examination Reporting & History:** Chronological activity timeline, comprehensive scoring, local JSON persistence, and performance summaries.

---

## 🏗️ Technical Architecture

- **Desktop Shell:** Electron.js (Main Process & sandboxed Preload script)
- **Frontend / UI:** React.js + Vite (ES Modules, custom responsive CSS)
- **IPC Layer:** Secure two-way communication using `contextBridge` exposing `window.examTrace` (no direct `ipcRenderer` in renderer)
- **Local Storage:** Atomic JSON persistence (`app.getPath("userData")`) with queued writes and temporary-file renaming
- **Security:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, password hashing with random salt and `timingSafeEqual`

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- npm (v10+)
- macOS (Apple Silicon / Intel) or supported desktop OS

### Installation
```bash
git clone https://github.com/emphor11/Desktop_AD_Project.git
cd Desktop_AD_Project
npm install
```

### Development
To run Vite dev server and Electron concurrently:
```bash
npm run electron:dev
```

### Testing Phase 1 Foundation
To verify Electron window initialization, user data path resolution, and secure IPC communication:
```bash
npm run test:phase1
```

### Production Build
```bash
npm run build
npm run electron:preview
```

---

## 📚 Development Status

- [x] **Phase 1:** Electron Foundation and Project Identity (App shell, context isolation, verified IPC bridge)
- [ ] **Phase 2:** JSON Storage Service, Scrypt Examiner Authentication & Exam Creator
- [ ] **Phase 3:** Candidate Identity & Authoritative Examination Engine
- [ ] **Phase 4:** Desktop Activity Monitoring (Focus, Fullscreen, Idle)
- [ ] **Phase 5:** Durable Attempts, History, Reports & Restart Recovery
- [ ] **Phase 6:** Analytics, Settings & UI Polish
- [ ] **Phase 7:** Optional Enhancements (Camera Preview / Screenshot Capture)
- [ ] **Phase 8:** Packaging, End-to-End Verification & Viva Preparation
