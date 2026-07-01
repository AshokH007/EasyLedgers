const { app, BrowserWindow } = require('electron');
const { fork } = require('child_process');
const path = require('path');

let serverProcess;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "TALLY Lite - Billing & Inventory Management",
    icon: path.join(__dirname, 'frontend', 'dist', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load local production server
  win.loadURL('http://localhost:5000');
  
  // Hide default menu bar (File, Edit, etc)
  win.setMenuBarVisibility(false);
}

// Single instance lock to prevent double server bindings
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    console.log("Launching offline backend server...");
    
    // Spawn backend server as a child process
    serverProcess = fork(path.join(__dirname, 'backend', 'server.js'), [], {
      env: { 
        ...process.env, 
        NODE_ENV: 'production', 
        PORT: 5000 
      }
    });

    serverProcess.on('error', (err) => {
      console.error('Backend process error:', err);
    });

    // Wait for the backend server to launch, then create Electron window
    setTimeout(() => {
      createWindow();
    }, 2000);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
    app.quit();
  }
});
