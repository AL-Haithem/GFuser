import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { saveTheme } from './appearance/appearance.js';
import DashboardFeature from './dashboard/DashboardFeature.jsx';
import { CreateProjectDialog, DeleteProjectDialog, ProjectsSidebar } from './projects/ProjectsFeature.jsx';
import { makeProject, saveProjects } from './projects/projects.js';
import SettingsFeature from './settings/SettingsFeature.jsx';
import StartupFeature from './startup/StartupFeature.jsx';
import { createStartupSteps } from './startup/startup.js';
import { getUpdateStatusLabel } from './update/updates.js';

function App() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectCreationPending, setProjectCreationPending] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [projectDeletionPending, setProjectDeletionPending] = useState(false);
  const [projectFilesPending, setProjectFilesPending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState('light');
  const [appDataLoaded, setAppDataLoaded] = useState(false);
  const [startupReady, setStartupReady] = useState(false);
  const [startupSteps, setStartupSteps] = useState(createStartupSteps);
  const [appVersion, setAppVersion] = useState('');
  const [toast, setToast] = useState('');
  const [updateState, setUpdateState] = useState({ status: 'idle', currentVersion: '', automaticUpdatesEnabled: true, progress: 0, message: 'Loading update settings...' });
  const [updateActionPending, setUpdateActionPending] = useState(false);
  const [preferencePending, setPreferencePending] = useState(false);

  const updateStatusLabel = getUpdateStatusLabel(updateState.status);

  useEffect(() => {
    let active = true;
    const api = window.appAPI;
    if (!api?.getAppData || !api?.getUpdateState) {
      setAppDataLoaded(true);
      setStartupSteps((steps) => steps.map((step) => ({ ...step, status: 'complete' })));
      const timeout = window.setTimeout(() => {
        if (active) setStartupReady(true);
      }, 650);
      return () => {
        active = false;
        window.clearTimeout(timeout);
      };
    }

    const setStepStatus = (stepId, status) => {
      if (!active) return;
      setStartupSteps((steps) => steps.map((step) => (step.id === stepId ? { ...step, status } : step)));
    };
    const applyUpdateState = (state) => {
      if (!active) return;
      setUpdateState((current) => ({ ...current, ...state }));
      if (state.currentVersion) setAppVersion(state.currentVersion);
    };
    const unsubscribe = api.onUpdateState?.(applyUpdateState);

    const dataRequest = api.getAppData().then((data) => {
      if (!active) return;
      setProjects(Array.isArray(data.projects) ? data.projects : []);
      setTheme(data.theme === 'dark' ? 'dark' : 'light');
      setStepStatus('data', 'complete');
    }).catch((error) => {
      setStepStatus('data', 'error');
      if (active) notify(error.message || 'Could not load saved app data.');
    }).finally(() => {
      if (active) setAppDataLoaded(true);
    });

    const updateRequest = api.getUpdateState().then((state) => {
      applyUpdateState(state);
      setStepStatus('version', state.currentVersion ? 'complete' : 'error');
      setStepStatus('updates', 'complete');
    }).catch((error) => {
      setStepStatus('version', 'error');
      setStepStatus('updates', 'error');
      if (active) notify(error.message || 'Could not initialize update status.');
    });

    let minimumDisplayTimeout;
    const minimumDisplay = new Promise((resolve) => {
      minimumDisplayTimeout = window.setTimeout(resolve, 650);
    });
    Promise.allSettled([dataRequest, updateRequest, minimumDisplay]).then(() => {
      if (active) setStartupReady(true);
    });

    return () => {
      active = false;
      unsubscribe?.();
      window.clearTimeout(minimumDisplayTimeout);
    };
  }, []);

  useEffect(() => {
    if (!appDataLoaded) return;
    saveProjects(projects).catch((error) => notify(error.message || 'Could not save projects.'));
  }, [projects, appDataLoaded]);

  useEffect(() => {
    if (!['available', 'downloaded', 'error'].includes(updateState.status)) return undefined;
    setToast(updateState.message);
    const timeout = window.setTimeout(() => setToast(''), 3600);
    return () => window.clearTimeout(timeout);
  }, [updateState.status, updateState.message]);

  function notify(message) { setToast(message); }

  function changeTheme(nextTheme) {
    setTheme(nextTheme);
    saveTheme(nextTheme).catch((error) => notify(error.message || 'Could not save the appearance setting.'));
  }

  async function createProject() {
    if (!appDataLoaded) return;
    const name = newProjectName.trim();
    if (!name) { notify('Project name is required.'); return; }
    if (projectCreationPending) return;
    setProjectCreationPending(true);
    try {
      let project = makeProject(name);
      if (window.appAPI?.createProject) {
        project = await window.appAPI.createProject(project);
      }
      setProjects((current) => [project, ...current]);
      setSelectedProjectId(project.id);
      setNewProjectName('');
      setShowCreateProject(false);
      notify(`Project “${name}” created.`);
    } catch (error) {
      notify(error.message || 'Could not create the project.');
    } finally {
      setProjectCreationPending(false);
    }
  }

  async function addFilesToSelectedProject() {
    const project = projects.find((item) => item.id === selectedProjectId);
    if (!project || projectFilesPending) return;
    if (!window.appAPI?.addProjectFiles) {
      notify('File attachments are only available in the installed desktop app.');
      return;
    }
    setProjectFilesPending(true);
    try {
      const selectedFiles = await window.appAPI.selectProjectFiles();
      if (!selectedFiles.length) return;
      const updatedProject = await window.appAPI.addProjectFiles(project.id, selectedFiles.map((file) => file.path));
      setProjects((current) => current.map((item) => (item.id === updatedProject.id ? updatedProject : item)));
      notify(`Added ${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'} to ${project.name}.`);
    } catch (error) {
      notify(error.message || 'Could not add files to the project.');
    } finally {
      setProjectFilesPending(false);
    }
  }

  async function showProjectFileInFolder(filePath) {
    if (!window.appAPI?.showProjectFileInFolder) {
      notify('Opening file locations is only available in the desktop app.');
      return;
    }
    try {
      await window.appAPI.showProjectFileInFolder(filePath);
    } catch (error) {
      notify(error.message || 'Could not open the file location.');
    }
  }

  async function openProjectDirectory() {
    const project = projects.find((item) => item.id === selectedProjectId);
    if (!project?.directoryPath) return;
    try {
      await window.appAPI.openProjectDirectory(project.id);
    } catch (error) {
      notify(error.message || 'Could not open the project folder.');
    }
  }

  function requestProjectDeletion(id) {
    setProjectToDelete(projects.find((project) => project.id === id) ?? null);
  }

  async function deleteProject() {
    if (!projectToDelete || projectDeletionPending) return;
    setProjectDeletionPending(true);
    try {
      if (window.appAPI?.deleteProject) await window.appAPI.deleteProject(projectToDelete.id);
      const remainingProjects = projects.filter((project) => project.id !== projectToDelete.id);
      setProjects(remainingProjects);
      if (selectedProjectId === projectToDelete.id) setSelectedProjectId(remainingProjects[0]?.id ?? '');
      setProjectToDelete(null);
      notify(`Project “${projectToDelete.name}” deleted.`);
    } catch (error) {
      notify(error.message || 'Could not delete the project.');
    } finally {
      setProjectDeletionPending(false);
    }
  }

  async function checkForUpdates() {
    if (!window.appAPI?.checkForUpdates) { notify('Update checks are only available in the installed desktop app.'); return; }
    setUpdateActionPending(true);
    try {
      const state = await window.appAPI.checkForUpdates();
      if (state) setUpdateState((current) => ({ ...current, ...state }));
    } catch (error) {
      setUpdateState((current) => ({ ...current, status: 'error', message: error.message || 'Could not check for updates.' }));
    } finally { setUpdateActionPending(false); }
  }

  async function changeAutomaticUpdates(event) {
    const enabled = event.target.checked;
    if (!window.appAPI?.setAutomaticUpdatesEnabled) { notify('Automatic update controls are only available in the desktop app.'); return; }
    setPreferencePending(true);
    try {
      const state = await window.appAPI.setAutomaticUpdatesEnabled(enabled);
      if (state) setUpdateState((current) => ({ ...current, ...state }));
    } catch (error) { notify(error.message || 'Could not save the update preference.'); }
    finally { setPreferencePending(false); }
  }

  async function downloadUpdate() {
    if (!window.appAPI?.downloadUpdate) { notify('Update downloads are only available in the installed desktop app.'); return; }
    setUpdateActionPending(true);
    try {
      const state = await window.appAPI.downloadUpdate();
      if (state) setUpdateState((current) => ({ ...current, ...state }));
    } catch (error) {
      setUpdateState((current) => ({ ...current, status: 'error', message: error.message || 'Could not download the update.' }));
    } finally { setUpdateActionPending(false); }
  }

  async function installUpdate() {
    if (!window.appAPI?.installUpdate) { notify('Install actions are only available in the desktop app.'); return; }
    setUpdateActionPending(true);
    try { await window.appAPI.installUpdate(); }
    catch (error) { setUpdateActionPending(false); notify(error.message || 'Could not install the update.'); }
  }

  if (!startupReady) return <StartupFeature steps={startupSteps} version={appVersion} theme={theme} />;

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  return (
    <div className={`app-shell ${theme === 'dark' ? 'theme-dark' : ''}`}>
      <ProjectsSidebar projects={projects} selectedProjectId={selectedProjectId} onSelect={setSelectedProjectId} onCreate={() => setShowCreateProject(true)} onDelete={requestProjectDeletion} createDisabled={!appDataLoaded} />
      <DashboardFeature project={selectedProject} pending={updateActionPending} filesPending={projectFilesPending} appDataLoaded={appDataLoaded} onCheckUpdates={checkForUpdates} onSettings={() => setShowSettings(true)} onCreateProject={() => setShowCreateProject(true)} onAddFiles={addFilesToSelectedProject} onShowFileInFolder={showProjectFileInFolder} onOpenProjectDirectory={openProjectDirectory} />
      {showCreateProject && <CreateProjectDialog name={newProjectName} onNameChange={setNewProjectName} onClose={() => setShowCreateProject(false)} onCreate={createProject} pending={projectCreationPending} />}
      {projectToDelete && <DeleteProjectDialog project={projectToDelete} onClose={() => setProjectToDelete(null)} onConfirm={deleteProject} pending={projectDeletionPending} />}
      <SettingsFeature
        open={showSettings}
        onClose={() => setShowSettings(false)}
        theme={theme}
        onThemeChange={changeTheme}
        updateState={updateState}
        updateStatusLabel={updateStatusLabel}
        updateActionPending={updateActionPending}
        preferencePending={preferencePending}
        onCheckUpdates={checkForUpdates}
        onAutomaticUpdatesChange={changeAutomaticUpdates}
        onDownloadUpdate={downloadUpdate}
        onInstallUpdate={installUpdate}
      />
      {toast && <div className="toast" role="status"><Check size={15} />{toast}<button type="button" onClick={() => setToast('')} aria-label="Dismiss notification"><X size={15} /></button></div>}
    </div>
  );
}

export default App;
