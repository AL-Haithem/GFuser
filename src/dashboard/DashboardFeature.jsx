import { FilePlus2, FileText, FolderOpen, Plus, RefreshCw, Settings2 } from 'lucide-react';
import './dashboard.css';

export default function DashboardFeature({ project, pending, filesPending, appDataLoaded, onCheckUpdates, onSettings, onCreateProject, onAddFiles, onShowFileInFolder, onOpenProjectDirectory }) {
  return (
    <main className="main-panel">
      <header className="topbar">
        <div className="breadcrumb"><span>Workspace</span>{project && <><span>/</span><strong>{project.name}</strong></>}</div>
        <div className="top-actions">
          <button className="toolbar-button" onClick={onCheckUpdates} disabled={pending}><RefreshCw size={14} className={pending ? 'spinning' : ''} />Check for updates</button>
          <button className="toolbar-button" onClick={onSettings} disabled={!appDataLoaded}><Settings2 size={14} />Settings</button>
          <button className="primary-button" onClick={onCreateProject} disabled={!appDataLoaded}><Plus size={14} />New project</button>
        </div>
      </header>
      {project ? (
        <section className="workspace-content" aria-label={`${project.name} workspace`}>
          <div className="workspace-project-heading">
            <div className="workspace-project-info"><span className="eyebrow">PROJECT WORKSPACE</span><h1>{project.name}</h1><p>{project.files?.length ?? 0} files</p><small className="workspace-directory-path" title={project.directoryPath ?? 'No project folder selected'}>{project.directoryPath ?? 'No project folder selected'}</small></div>
            <div className="workspace-project-actions">
              <button className="toolbar-button" onClick={onOpenProjectDirectory}><FolderOpen size={15} />Open project folder</button>
              <button className="primary-button" onClick={onAddFiles} disabled={filesPending}><FilePlus2 size={15} />{filesPending ? 'Adding files…' : 'Add files'}</button>
            </div>
          </div>
          {project.files?.length ? (
            <div className="workspace-file-list" aria-label="Project files">
              {project.files.map((file) => <div className="workspace-file-row" key={file.path ?? file.storedName}><span className="workspace-file-icon"><FileText size={17} /></span><span className="workspace-file-details"><span className="workspace-file-name" title={file.name}>{file.name}</span><small title={file.path ?? 'Stored in project'}>{file.path ?? 'Stored in project'}</small></span><span className="workspace-file-size">{formatFileSize(file.size)}</span>{file.path && <button className="icon-button workspace-open-file" type="button" onClick={() => onShowFileInFolder(file.path)} aria-label={`Show ${file.name} in folder`} title="Show in folder"><FolderOpen size={15} /></button>}</div>)}
            </div>
          ) : (
            <div className="workspace-files-empty"><FilePlus2 size={22} /><strong>No files in this project</strong><span>Add files here to keep them with this project.</span></div>
          )}
        </section>
      ) : (
        <section className="workspace-no-project"><h1>No project selected</h1><p>Create a project or choose one from the sidebar.</p><button className="primary-button" onClick={onCreateProject} disabled={!appDataLoaded}><Plus size={14} />New project</button></section>
      )}
    </main>
  );
}

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
