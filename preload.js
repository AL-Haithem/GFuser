const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appAPI', {
  getAppData: () => ipcRenderer.invoke('get-app-data'),
  saveProjects: (projects) => ipcRenderer.invoke('save-projects', projects),
  selectProjectFiles: () => ipcRenderer.invoke('select-project-files'),
  openProjectDirectory: (projectId) => ipcRenderer.invoke('open-project-directory', projectId),
  showProjectFileInFolder: (filePath) => ipcRenderer.invoke('show-project-file-in-folder', filePath),
  createProject: (project) => ipcRenderer.invoke('create-project', project),
  addProjectFiles: (projectId, filePaths) => ipcRenderer.invoke('add-project-files', projectId, filePaths),
  deleteProject: (projectId) => ipcRenderer.invoke('delete-project', projectId),
  saveTheme: (theme) => ipcRenderer.invoke('save-theme', theme),
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  setAutomaticUpdatesEnabled: (enabled) => ipcRenderer.invoke('set-automatic-updates', enabled),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('update-state', listener);
    return () => ipcRenderer.removeListener('update-state', listener);
  },
});
