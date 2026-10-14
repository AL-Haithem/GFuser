const { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const legacyUserDataPath = app.getPath('userData');
app.setPath('userData', path.join(app.getPath('documents'), 'GFuser'));

const { autoUpdater } = require('electron-updater');

let appSettings = { automaticUpdatesEnabled: false, projects: [], theme: 'light' };
let updateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  automaticUpdatesEnabled: false,
  progress: 0,
  message: 'Updates have not been checked yet.',
};
let mainWindow;

protocol.registerSchemesAsPrivileged([{
  scheme: 'gfuser',
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

  if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadURL('gfuser://app/index.html');
  }
}

function getAppSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function getProjectsRootPath() {
  return path.join(app.getPath('userData'), 'prs');
}

function getSafeProjectFolderName(name) {
  let folderName = name.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 100).replace(/[. ]+$/g, '');
  if (!folderName || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(folderName)) {
    folderName = `${folderName || 'Project'}_project`;
  }
  return folderName;
}

function getUniqueProjectDirectoryPath(projectName, projects, reservedNames = new Set()) {
  const rootPath = getProjectsRootPath();
  fs.mkdirSync(rootPath, { recursive: true });
  const baseName = getSafeProjectFolderName(projectName);
  const reservedPaths = new Set(projects.filter((project) => project.directoryPath)
    .map((project) => path.resolve(project.directoryPath).toLowerCase()));
  let folderName = baseName;
  let suffix = 2;
  let directoryPath = path.join(rootPath, folderName);
  while (reservedNames.has(folderName.toLowerCase()) || reservedPaths.has(path.resolve(directoryPath).toLowerCase())) {
    folderName = `${baseName} (${suffix})`;
    suffix += 1;
    directoryPath = path.join(rootPath, folderName);
  }
  fs.mkdirSync(directoryPath, { recursive: true });
  return { directoryPath, folderName };
}

function ensureProjectDirectories(projects) {
  const rootPath = path.resolve(getProjectsRootPath());
  fs.mkdirSync(rootPath, { recursive: true });
  const rootComparisonPath = rootPath.toLowerCase();
  const assignedNames = new Set();
  const preparedProjects = projects.map((project) => {
    const baseName = getSafeProjectFolderName(project.name);
    const currentPath = typeof project.directoryPath === 'string' ? path.resolve(project.directoryPath) : '';
    const currentName = currentPath ? path.basename(currentPath) : '';
    const matchesProjectName = currentName.toLowerCase() === baseName.toLowerCase()
      || currentName.toLowerCase().startsWith(`${baseName.toLowerCase()} (`);
    if (currentPath && path.dirname(currentPath).toLowerCase() === rootComparisonPath
      && matchesProjectName && !assignedNames.has(currentName.toLowerCase())) {
      assignedNames.add(currentName.toLowerCase());
      fs.mkdirSync(currentPath, { recursive: true });
      return { ...project, directoryPath: currentPath };
    }
    return { ...project, directoryPath: '' };
  });

  return preparedProjects.map((project) => {
    if (project.directoryPath) return project;
    const { directoryPath, folderName } = getUniqueProjectDirectoryPath(project.name, [], assignedNames);
    assignedNames.add(folderName.toLowerCase());
    return { ...project, directoryPath };
  });
}

function getProjectSettingsPath(project) {
  return path.join(project.directoryPath, 'settings.json');
}

function saveProjectSettings(project) {
  const rootPath = path.resolve(getProjectsRootPath()).toLowerCase();
  if (path.dirname(path.resolve(project.directoryPath)).toLowerCase() !== rootPath) {
    throw new TypeError('Project folders must be directly inside the GFuser data folder.');
  }
  fs.mkdirSync(project.directoryPath, { recursive: true });
  fs.writeFileSync(getProjectSettingsPath(project), JSON.stringify({
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    status: project.status,
    directoryPath: project.directoryPath,
    files: project.files,
  }, null, 2));
}

function loadProjectSettings() {
  const projectsById = new Map();
  [app.getPath('userData'), getProjectsRootPath()].forEach((rootPath) => {
    if (!fs.existsSync(rootPath)) return;
    fs.readdirSync(rootPath, { withFileTypes: true }).filter((entry) => entry.isDirectory()).forEach((entry) => {
      const directoryPath = path.join(rootPath, entry.name);
      try {
        const storedProject = JSON.parse(fs.readFileSync(path.join(directoryPath, 'settings.json'), 'utf8'));
        const [project] = normalizeProjects([{ ...storedProject, directoryPath }]);
        if (project) projectsById.set(project.id, project);
      } catch {
        return;
      }
    });
  });
  return [...projectsById.values()];
}

function removeMigratedProjectSettings(previousProjects, currentProjects) {
  const appRootPath = path.resolve(app.getPath('userData')).toLowerCase();
  previousProjects.forEach((previousProject) => {
    if (!previousProject.directoryPath) return;
    const previousDirectory = path.resolve(previousProject.directoryPath);
    if (path.dirname(previousDirectory).toLowerCase() !== appRootPath) return;
    const currentProject = currentProjects.find((project) => project.id === previousProject.id);
    if (!currentProject || path.resolve(currentProject.directoryPath).toLowerCase() === previousDirectory.toLowerCase()) return;
    const settingsPath = path.join(previousDirectory, 'settings.json');
    if (readSettingsFile(settingsPath)?.id !== previousProject.id) return;
    fs.rmSync(settingsPath, { force: true });
    try { fs.rmdirSync(previousDirectory); } catch {}
  });
}

function persistProjects(projects) {
  const normalizedProjects = ensureProjectDirectories(normalizeProjects(projects, true));
  normalizedProjects.forEach(saveProjectSettings);
  appSettings.projects = normalizedProjects;
  return normalizedProjects;
}

function normalizeProjects(projects, strict = false) {
  if (!Array.isArray(projects) || projects.length > 5000) {
    if (strict) throw new TypeError('Projects must be an array with no more than 5000 entries.');
    return [];
  }

  const normalizedProjects = [];
  for (const project of projects) {
    if (
      !project
      || typeof project.id !== 'string'
      || typeof project.name !== 'string'
      || !project.name.trim()
      || project.name.length > 250
    ) {
      if (strict) throw new TypeError('Each project must have a valid ID and name.');
      continue;
    }

    normalizedProjects.push({
      id: project.id,
      name: project.name.trim(),
      createdAt: typeof project.createdAt === 'string' ? project.createdAt : '',
      status: typeof project.status === 'string' ? project.status : 'Ready',
      ...(typeof project.directoryPath === 'string' && path.isAbsolute(project.directoryPath) ? { directoryPath: project.directoryPath } : {}),
      files: Array.isArray(project.files) ? project.files.filter((file) => (
        file && typeof file.name === 'string'
        && (typeof file.path === 'string' || typeof file.storedName === 'string')
        && Number.isFinite(file.size) && file.size >= 0
      )).map((file) => ({
        name: file.name,
        size: file.size,
        ...(typeof file.path === 'string' ? { path: file.path } : {}),
        ...(typeof file.storedName === 'string' ? { storedName: file.storedName } : {}),
      })) : [],
    });
  }
  return normalizedProjects;
}

function loadAppSettings() {
  const currentSettings = readSettingsFile(getAppSettingsPath());
  const legacySettings = currentSettings?.legacyProjectsMigrated
    ? null
    : readSettingsFile(path.join(legacyUserDataPath, 'settings.json'));
  const importedProjects = [
    ...normalizeProjects(currentSettings?.projects),
    ...normalizeProjects(legacySettings?.projects),
  ];
  const projectsById = new Map(importedProjects.map((project) => [project.id, project]));
  loadProjectSettings().forEach((project) => projectsById.set(project.id, project));
  return {
    automaticUpdatesEnabled: (currentSettings ?? legacySettings)?.automaticUpdatesEnabled !== false,
    projects: [...projectsById.values()],
    theme: (currentSettings ?? legacySettings)?.theme === 'dark' ? 'dark' : 'light',
    legacyProjectsMigrated: true,
  };
}

function readSettingsFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function saveAppSettings(changes) {
  const nextSettings = { ...appSettings, ...changes };
  const settingsPath = getAppSettingsPath();
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify({
    automaticUpdatesEnabled: nextSettings.automaticUpdatesEnabled,
    theme: nextSettings.theme,
    legacyProjectsMigrated: true,
  }, null, 2));
  appSettings = nextSettings;
  return appSettings;
}

function getUpdateState() {
  return {
    ...updateState,
    currentVersion: app.getVersion(),
    automaticUpdatesEnabled: appSettings.automaticUpdatesEnabled,
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
  autoUpdater.autoDownload = appSettings.automaticUpdatesEnabled;
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
  protocol.handle('gfuser', (request) => {
    const requestedPath = decodeURIComponent(new URL(request.url).pathname).replace(/^[/\\]+/, '') || 'index.html';
    const filePath = path.resolve(distDirectory, requestedPath);
    if (!filePath.startsWith(`${distDirectory}${path.sep}`)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });

  appSettings = loadAppSettings();
  const previousProjectPaths = appSettings.projects;
  appSettings.projects = persistProjects(appSettings.projects);
  removeMigratedProjectSettings(previousProjectPaths, appSettings.projects);
  saveAppSettings({});
  updateState.automaticUpdatesEnabled = appSettings.automaticUpdatesEnabled;
  configureAutoUpdater();

  ipcMain.handle('get-app-data', () => ({ projects: appSettings.projects, theme: appSettings.theme }));
  ipcMain.handle('save-projects', (_event, projects) => persistProjects(projects));
  ipcMain.handle('select-project-files', async (event) => {
    const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
      properties: ['openFile', 'multiSelections'],
    });
    if (result.canceled) return [];
    return result.filePaths.map((filePath) => {
      const file = fs.statSync(filePath);
      return { path: filePath, name: path.basename(filePath), size: file.size };
    });
  });
  ipcMain.handle('open-project-directory', async (_event, projectId) => {
    if (typeof projectId !== 'string' || !/^proj-[a-z0-9-]+$/i.test(projectId)) {
      throw new TypeError('A valid project is required.');
    }
    const project = appSettings.projects.find((item) => item.id === projectId);
    if (!project?.directoryPath) throw new Error('Choose a project folder first.');
    if (!fs.statSync(project.directoryPath).isDirectory()) throw new Error('The project folder no longer exists.');
    const error = await shell.openPath(project.directoryPath);
    if (error) throw new Error(error);
  });
  ipcMain.handle('show-project-file-in-folder', (_event, filePath) => {
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
      throw new TypeError('A valid file path is required.');
    }
    if (!fs.statSync(filePath).isFile()) throw new TypeError('The selected path is not a file.');
    shell.showItemInFolder(filePath);
  });
  ipcMain.handle('create-project', (_event, project) => {
    if (!project || typeof project.id !== 'string' || !/^proj-[a-z0-9-]+$/i.test(project.id)
      || typeof project.name !== 'string' || !project.name.trim() || project.name.length > 250) {
      throw new TypeError('A valid project name is required.');
    }
    const { directoryPath } = getUniqueProjectDirectoryPath(project.name, appSettings.projects);
    const [savedProject] = normalizeProjects([{ ...project, directoryPath, files: [] }], true);
    saveProjectSettings(savedProject);
    appSettings.projects = [savedProject, ...appSettings.projects.filter((item) => item.id !== savedProject.id)];
    return savedProject;
  });
  ipcMain.handle('add-project-files', (_event, projectId, filePaths) => {
    if (typeof projectId !== 'string' || !/^proj-[a-z0-9-]+$/i.test(projectId)) {
      throw new TypeError('A valid project is required.');
    }
    if (!Array.isArray(filePaths) || filePaths.length > 100 || filePaths.some((filePath) => typeof filePath !== 'string')) {
      throw new TypeError('Project files must be a list of no more than 100 file paths.');
    }
    const project = appSettings.projects.find((item) => item.id === projectId);
    if (!project) throw new Error('The selected project could not be found.');
    if (!filePaths.length) return project;

    const files = [...project.files];
    const existingPaths = new Set(files.filter((file) => file.path).map((file) => file.path));
    filePaths.forEach((filePath) => {
      if (existingPaths.has(filePath)) return;
      const sourceStat = fs.statSync(filePath);
      if (!sourceStat.isFile()) throw new TypeError('Project attachments must be files.');
      files.push({ path: filePath, name: path.basename(filePath), size: sourceStat.size });
      existingPaths.add(filePath);
    });
    const updatedProject = { ...project, files };
    saveProjectSettings(updatedProject);
    appSettings.projects = appSettings.projects.map((item) => (item.id === projectId ? updatedProject : item));
    return updatedProject;
  });
  ipcMain.handle('delete-project', (_event, projectId) => {
    if (typeof projectId !== 'string' || !/^proj-[a-z0-9-]+$/i.test(projectId)) {
      throw new TypeError('A valid project is required.');
    }
    const project = appSettings.projects.find((item) => item.id === projectId);
    if (!project) throw new Error('The selected project could not be found.');
    fs.rmSync(getProjectSettingsPath(project), { force: true });
    appSettings.projects = appSettings.projects.filter((item) => item.id !== projectId);
    return appSettings.projects;
  });
  ipcMain.handle('save-theme', (_event, theme) => {
    if (theme !== 'light' && theme !== 'dark') throw new TypeError('Theme must be light or dark.');
    return saveAppSettings({ theme }).theme;
  });

  ipcMain.handle('get-update-state', () => getUpdateState());
  ipcMain.handle('check-for-updates', () => checkForUpdates());
  ipcMain.handle('set-automatic-updates', async (_event, enabled) => {
    if (typeof enabled !== 'boolean') throw new TypeError('Automatic updates must be a boolean.');
    saveAppSettings({ automaticUpdatesEnabled: enabled });
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
  if (app.isPackaged && appSettings.automaticUpdatesEnabled) checkForUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
