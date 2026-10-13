const { app, BrowserWindow, ipcMain, net, protocol } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');

let updateSettings = { automaticUpdatesEnabled: true };
let updateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  automaticUpdatesEnabled: true,
  progress: 0,
  message: 'Updates have not been checked yet.',
};
let mainWindow;

protocol.registerSchemesAsPrivileged([{
  scheme: 'mapfusion',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
}]);

function createWindow() {
  mainWindow = new BrowserWindow({
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
  mainWindow.removeMenu();

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadURL('mapfusion://app/index.html');
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

function getUpdateSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadUpdateSettings() {
  try {
    const settings = JSON.parse(fs.readFileSync(getUpdateSettingsPath(), 'utf8'));
    return { automaticUpdatesEnabled: settings.automaticUpdatesEnabled !== false };
  } catch {
    return { automaticUpdatesEnabled: true };
  }
}

function saveUpdateSettings() {
  const settingsPath = getUpdateSettingsPath();
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(updateSettings, null, 2));
}

function getUpdateState() {
  return {
    ...updateState,
    currentVersion: app.getVersion(),
    automaticUpdatesEnabled: updateSettings.automaticUpdatesEnabled,
  };
}

function publishUpdateState(changes) {
  updateState = { ...updateState, ...changes };
  const state = getUpdateState();
  BrowserWindow.getAllWindows().forEach((win) => win.webContents.send('update-state', state));
}

async function checkForUpdates() {
  if (!app.isPackaged) {
    publishUpdateState({ status: 'error', message: 'Update checks are available in an installed build.' });
    return getUpdateState();
  }

  publishUpdateState({ status: 'checking', progress: 0, message: 'Checking for updates...' });
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    publishUpdateState({ status: 'error', message: error.message || 'Could not check for updates.' });
  }
  return getUpdateState();
}

function configureAutoUpdater() {
  autoUpdater.autoDownload = updateSettings.automaticUpdatesEnabled;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => {
    publishUpdateState({ status: 'checking', progress: 0, message: 'Checking for updates...' });
  });
  autoUpdater.on('update-available', (info) => {
    publishUpdateState({
      status: 'available',
      availableVersion: info.version,
      progress: 0,
      message: `Version ${info.version} is available.`,
    });
  });
  autoUpdater.on('update-not-available', () => {
    publishUpdateState({ status: 'up-to-date', availableVersion: null, progress: 0, message: 'You are using the latest version.' });
  });
  autoUpdater.on('download-progress', (progress) => {
    publishUpdateState({
      status: 'downloading',
      progress: Math.round(progress.percent),
      message: `Downloading update... ${Math.round(progress.percent)}%`,
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    publishUpdateState({
      status: 'downloaded',
      availableVersion: info.version,
      progress: 100,
      message: `Version ${info.version} is ready to install.`,
    });
  });
  autoUpdater.on('error', (error) => {
    publishUpdateState({ status: 'error', message: error.message || 'The update process failed.' });
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

  updateSettings = loadUpdateSettings();
  updateState.automaticUpdatesEnabled = updateSettings.automaticUpdatesEnabled;
  configureAutoUpdater();

  ipcMain.handle('get-update-state', () => getUpdateState());
  ipcMain.handle('check-for-updates', () => checkForUpdates());
  ipcMain.handle('set-automatic-updates', async (_event, enabled) => {
    if (typeof enabled !== 'boolean') throw new TypeError('Automatic updates must be a boolean.');
    updateSettings = { automaticUpdatesEnabled: enabled };
    saveUpdateSettings();
    autoUpdater.autoDownload = enabled;
    publishUpdateState({ automaticUpdatesEnabled: enabled });
    if (enabled) return checkForUpdates();
    return getUpdateState();
  });
  ipcMain.handle('download-update', async () => {
    if (!app.isPackaged) throw new Error('Update downloads are available in an installed build.');
    try {
      await autoUpdater.downloadUpdate();
      return getUpdateState();
    } catch (error) {
      publishUpdateState({ status: 'error', message: error.message || 'Could not download the update.' });
      return getUpdateState();
    }
  });
  ipcMain.handle('install-update', () => {
    if (updateState.status !== 'downloaded') throw new Error('There is no downloaded update to install.');
    autoUpdater.quitAndInstall();
  });

  createWindow();
  if (app.isPackaged && updateSettings.automaticUpdatesEnabled) checkForUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
