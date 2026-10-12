const { app, BrowserWindow, ipcMain, net, protocol } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');

protocol.registerSchemesAsPrivileged([{
  scheme: 'mapfusion',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
}]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: '#f4f5f1',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadURL('mapfusion://app/index.html');
  }
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
  const distDirectory = path.resolve(__dirname, 'dist');
  protocol.handle('mapfusion', (request) => {
    const requestedPath = decodeURIComponent(new URL(request.url).pathname).replace(/^[/\\]+/, '') || 'index.html';
    const filePath = path.resolve(distDirectory, requestedPath);
    if (!filePath.startsWith(`${distDirectory}${path.sep}`)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });

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
