const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appAPI', {
  runMergedProject: () => ipcRenderer.invoke('run-merged-project'),
});
