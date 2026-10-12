const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

function runMergedProject() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'scripts', 'runMergedProject.js');
    const child = spawn(process.execPath, [scriptPath], {
      cwd: __dirname,
      shell: false,
      windowsHide: true,
    });
    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(output || 'Merged map pipeline finished successfully.');
      } else {
        reject(new Error(output || `Merged map pipeline exited with code ${code}.`));
      }
    });
  });
}

function checkForUpdates() {
  if (!app.isPackaged) return;

  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    console.error('Automatic update check failed:', error);
  });
}

app.whenReady().then(() => {
  ipcMain.handle('run-merged-project', async () => {
    return runMergedProject();
  });

  createWindow();
  checkForUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
