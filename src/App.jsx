import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CircleAlert,
  CircleCheck,
  Database,
  Download,
  FolderOpen,
  Moon,
  Plus,
  RefreshCw,
  Settings2,
  Sun,
  Trash2,
  X,
} from 'lucide-react';

const starterProjects = [
  { id: 'proj-1', name: 'Launch plan', createdAt: 'Today', status: 'Ready' },
  { id: 'proj-2', name: 'Client dashboard', createdAt: 'Yesterday', status: 'Draft' },
  { id: 'proj-3', name: 'Q4 review', createdAt: '2 days ago', status: 'Review' },
];

function App() {
  const [projects, setProjects] = useState(starterProjects);
  const [selectedProjectId, setSelectedProjectId] = useState(starterProjects[0].id);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return window.localStorage.getItem('mapfusion-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [toast, setToast] = useState('');
  const [updateState, setUpdateState] = useState({
    status: 'idle',
    currentVersion: '',
    automaticUpdatesEnabled: true,
    progress: 0,
    message: 'Loading update settings...',
  });
  const [updateActionPending, setUpdateActionPending] = useState(false);
  const [preferencePending, setPreferencePending] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId],
  );

  useEffect(() => {
    const api = window.appAPI;
    if (!api?.getUpdateState) return undefined;

    let subscribed = true;
    const applyState = (state) => {
      if (subscribed) setUpdateState((current) => ({ ...current, ...state }));
    };

    const unsubscribe = api.onUpdateState?.(applyState);
    api.getUpdateState().then(applyState).catch((error) => {
      applyState({ status: 'error', message: error.message || 'Could not load update settings.' });
    });

    return () => {
      subscribed = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (['available', 'downloaded', 'error'].includes(updateState.status)) {
      notify(updateState.message);
    }
  }, [updateState.status, updateState.message]);

  function notify(message) {
    setToast(message);
    window.clearTimeout(notify.timeout);
    notify.timeout = window.setTimeout(() => setToast(''), 3600);
  }

  function changeTheme(nextTheme) {
    setTheme(nextTheme);
    try {
      window.localStorage.setItem('mapfusion-theme', nextTheme);
    } catch {
      notify('Theme will reset when the app closes because local storage is unavailable.');
    }
  }

  function createProject() {
    const name = newProjectName.trim();
    if (!name) {
      notify('Project name is required.');
      return;
    }

    const project = {
      id: `proj-${Date.now()}`,
      name,
      createdAt: 'Just now',
      status: 'Ready',
    };

    setProjects((current) => [project, ...current]);
    setSelectedProjectId(project.id);
    setNewProjectName('');
    setShowCreateProject(false);
    notify(`Project “${name}” created.`);
  }

  function deleteProject(id) {
    setProjects((current) => current.filter((project) => project.id !== id));
    if (selectedProjectId === id) {
      const next = projects.find((project) => project.id !== id);
      setSelectedProjectId(next ? next.id : '');
    }
  }

  async function checkForUpdates() {
    if (!window.appAPI?.checkForUpdates) {
      notify('Update checks are only available in the installed desktop app.');
      return;
    }

    setUpdateActionPending(true);
    try {
      const state = await window.appAPI.checkForUpdates();
      if (state) setUpdateState((current) => ({ ...current, ...state }));
    } catch (error) {
      setUpdateState((current) => ({ ...current, status: 'error', message: error.message || 'Could not check for updates.' }));
    } finally {
      setUpdateActionPending(false);
    }
  }

  async function changeAutomaticUpdates(event) {
    const enabled = event.target.checked;
    if (!window.appAPI?.setAutomaticUpdatesEnabled) {
      notify('Automatic update controls are only available in the desktop app.');
      return;
    }

    setPreferencePending(true);
    try {
      const state = await window.appAPI.setAutomaticUpdatesEnabled(enabled);
      if (state) setUpdateState((current) => ({ ...current, ...state }));
    } catch (error) {
      notify(error.message || 'Could not save the update preference.');
    } finally {
      setPreferencePending(false);
    }
  }

  async function downloadUpdate() {
    if (!window.appAPI?.downloadUpdate) {
      notify('Update downloads are only available in the desktop app.');
      return;
    }

    setUpdateActionPending(true);
    try {
      const state = await window.appAPI.downloadUpdate();
      if (state) setUpdateState((current) => ({ ...current, ...state }));
    } catch (error) {
      setUpdateState((current) => ({ ...current, status: 'error', message: error.message || 'Could not download the update.' }));
    } finally {
      setUpdateActionPending(false);
    }
  }

  async function installUpdate() {
    if (!window.appAPI?.installUpdate) {
      notify('Install actions are only available in the desktop app.');
      return;
    }

    setUpdateActionPending(true);
    try {
      await window.appAPI.installUpdate();
    } catch (error) {
      setUpdateActionPending(false);
      notify(error.message || 'Could not install the update.');
    }
  }

  const updateStatusLabels = {
    idle: 'Not checked',
    checking: 'Checking',
    available: 'Update available',
    downloading: 'Downloading',
    downloaded: 'Ready to install',
    'up-to-date': 'Up to date',
    error: 'Check failed',
  };

  const updateStatusLabel = updateStatusLabels[updateState.status] ?? 'Update status';

  return (
    <div className={`app-shell ${theme === 'dark' ? 'theme-dark' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-wrap">
            <span className="brand-mark"><Database size={18} /></span>
            <div>
              <span className="eyebrow">DESKTOP APP</span>
              <h1>MapFusion</h1>
            </div>
          </div>
          <button className="icon-button" onClick={() => setShowCreateProject(true)} aria-label="Create project">
            <Plus size={18} />
          </button>
        </div>

        <div className="project-list-header">
          <span>Projects</span>
          <strong>{projects.length}</strong>
        </div>

        <div className="project-list">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`project-card ${project.id === selectedProjectId ? 'selected' : ''}`}
            >
              <div className="project-card-top">
                <span className="project-pill">{project.status}</span>
                <button
                  type="button"
                  className="mini-delete"
                  aria-label={`Delete ${project.name}`}
                  onClick={() => deleteProject(project.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <button
                type="button"
                className="project-card-select"
                onClick={() => setSelectedProjectId(project.id)}
              >
                <strong>{project.name}</strong>
                <small>{project.createdAt}</small>
              </button>
            </div>
          ))}
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <strong>{selectedProject?.name ?? 'No project selected'}</strong>
          </div>
          <div className="top-actions">
            <button className="toolbar-button" onClick={checkForUpdates} disabled={updateActionPending}>
              <RefreshCw size={14} className={updateActionPending ? 'spinning' : ''} />
              Check for updates
            </button>
            <button className="toolbar-button" onClick={() => setShowSettings(true)}>
              <Settings2 size={14} />
              Settings
            </button>
            <button className="primary-button" onClick={() => setShowCreateProject(true)}>
              <Plus size={14} />
              New project
            </button>
          </div>
        </header>

        <section className="content-panel">
          <div className="hero-card">
            <div>
              <span className="eyebrow">CURRENT PROJECT</span>
              <h2>{selectedProject?.name ?? 'No project available'}</h2>
            </div>
            <div className="hero-meta">
              <span className="status-badge">{selectedProject?.status ?? 'Ready'}</span>
              <span>{selectedProject?.createdAt ?? 'Not created'}</span>
            </div>
          </div>

          <div className="stats-grid">
            <article className="stats-card">
              <span className="stats-label">Projects</span>
              <strong>{projects.length}</strong>
            </article>
            <article className="stats-card">
              <span className="stats-label">Theme</span>
              <strong>{theme === 'dark' ? 'Dark' : 'Light'}</strong>
            </article>
            <article className="stats-card">
              <span className="stats-label">Updates</span>
              <strong>{updateStatusLabel}</strong>
            </article>
          </div>

          <div className="panel-grid">
            <section className="info-card">
              <div className="card-header">
                <div>
                  <span className="eyebrow">APP STATUS</span>
                  <h3>Desktop workspace</h3>
                </div>
                <span className="online-dot" />
              </div>
              <p>Everything is running as a focused desktop app shell, with project management, theme switching, and update controls.</p>
              <div className="status-row">
                <span className="status-key">Update state</span>
                <strong>{updateStatusLabel}</strong>
              </div>
              <div className="status-row">
                <span className="status-key">Auto updates</span>
                <strong>{updateState.automaticUpdatesEnabled ? 'Enabled' : 'Disabled'}</strong>
              </div>
            </section>

            <section className="info-card">
              <div className="card-header">
                <div>
                  <span className="eyebrow">THEME</span>
                  <h3>Appearance</h3>
                </div>
                {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
              </div>
              <div className="theme-switcher" role="group" aria-label="Color theme">
                <button type="button" className={theme === 'light' ? 'active' : ''} onClick={() => changeTheme('light')}>
                  <Sun size={14} /> Light
                </button>
                <button type="button" className={theme === 'dark' ? 'active' : ''} onClick={() => changeTheme('dark')}>
                  <Moon size={14} /> Dark
                </button>
              </div>
            </section>
          </div>

          <section className="info-card wide">
            <div className="card-header">
              <div>
                <span className="eyebrow">PROJECTS</span>
                <h3>Quick actions</h3>
              </div>
              <FolderOpen size={16} />
            </div>
            <div className="quick-actions">
              <button className="primary-button" onClick={() => setShowCreateProject(true)}>
                <Plus size={14} /> Create project
              </button>
              <button className="secondary-button" onClick={() => setShowSettings(true)}>
                <Settings2 size={14} /> Open settings
              </button>
            </div>
          </section>
        </section>
      </main>

      {showCreateProject && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowCreateProject(false);
        }}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
            <header>
              <div>
                <span className="eyebrow">NEW PROJECT</span>
                <h3 id="create-project-title">Create a project</h3>
              </div>
              <button className="icon-button" onClick={() => setShowCreateProject(false)} aria-label="Close create form">
                <X size={18} />
              </button>
            </header>
            <label className="field-label">
              <span>Project name</span>
              <input
                type="text"
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="My new project"
                autoFocus
              />
            </label>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setShowCreateProject(false)}>Cancel</button>
              <button className="primary-button" onClick={createProject}>Create</button>
            </div>
          </section>
        </div>
      )}

      {showSettings && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowSettings(false);
        }}>
          <section className="modal-card settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <header>
              <div>
                <span className="eyebrow">APPLICATION</span>
                <h3 id="settings-title">Settings</h3>
              </div>
              <button className="icon-button" onClick={() => setShowSettings(false)} aria-label="Close settings">
                <X size={18} />
              </button>
            </header>

            <div className="settings-section">
              <div className="settings-heading">
                <strong>Appearance</strong>
                <p>Choose the app color theme.</p>
              </div>
              <div className="theme-switcher" role="group" aria-label="Color theme">
                <button type="button" className={theme === 'light' ? 'active' : ''} onClick={() => changeTheme('light')}>
                  <Sun size={14} /> Light
                </button>
                <button type="button" className={theme === 'dark' ? 'active' : ''} onClick={() => changeTheme('dark')}>
                  <Moon size={14} /> Dark
                </button>
              </div>
            </div>

            <div className="settings-divider" />

            <div className="settings-section update-panel">
              <div className="update-state-row">
                <span className="update-icon">
                  {updateState.status === 'error' ? <CircleAlert size={17} /> : updateState.status === 'up-to-date' || updateState.status === 'downloaded' ? <CircleCheck size={17} /> : <RefreshCw size={17} className={updateState.status === 'checking' || updateState.status === 'downloading' ? 'spinning' : ''} />}
                </span>
                <div>
                  <strong>Software updates</strong>
                  <p>{updateState.message}</p>
                </div>
              </div>

              <div className="settings-row">
                <span>Installed version</span>
                <strong>v{updateState.currentVersion || '...'}</strong>
              </div>

              {updateState.status === 'downloading' && (
                <div className="progress-wrap">
                  <div className="progress-head">
                    <span>Download progress</span>
                    <strong>{updateState.progress}%</strong>
                  </div>
                  <div className="progress-bar" aria-label="Update download progress" aria-valuenow={updateState.progress} aria-valuemin="0" aria-valuemax="100">
                    <span style={{ width: `${updateState.progress}%` }} />
                  </div>
                </div>
              )}

              <label className="toggle-row">
                <span>
                  <strong>Automatic updates</strong>
                  <small>Check and download automatically.</small>
                </span>
                <input type="checkbox" checked={updateState.automaticUpdatesEnabled} disabled={preferencePending} onChange={changeAutomaticUpdates} aria-label="Automatic updates" />
                <span className="switch-track" aria-hidden="true"><span /></span>
              </label>
            </div>

            <footer className="settings-footer">
              <button className="secondary-button" onClick={checkForUpdates} disabled={updateActionPending || updateState.status === 'checking'}>
                <RefreshCw size={14} className={updateState.status === 'checking' ? 'spinning' : ''} />
                Check now
              </button>
              {updateState.status === 'available' && !updateState.automaticUpdatesEnabled && (
                <button className="primary-button" onClick={downloadUpdate} disabled={updateActionPending}>
                  <Download size={14} />
                  Download
                </button>
              )}
              {updateState.status === 'downloaded' && (
                <button className="primary-button" onClick={installUpdate} disabled={updateActionPending}>
                  <RefreshCw size={14} />
                  Restart to install
                </button>
              )}
            </footer>
          </section>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          {toast}
          <button type="button" onClick={() => setToast('')} aria-label="Dismiss notification">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
