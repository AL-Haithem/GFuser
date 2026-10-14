import { Database, Plus, Trash2, X } from 'lucide-react';
import './projects.css';

export function ProjectsSidebar({ projects, selectedProjectId, onSelect, onCreate, onDelete, createDisabled }) {
  return (
    <aside className="projects-sidebar">
      <div className="projects-brand-row">
        <div className="projects-brand">
          <span className="projects-brand-mark"><Database size={18} /></span>
          <span><small>DESKTOP APP</small><strong>GFuser</strong></span>
        </div>
        <button className="icon-button" onClick={onCreate} aria-label="Create project" disabled={createDisabled}><Plus size={18} /></button>
      </div>
      <div className="projects-list-heading"><span>Projects</span></div>
      <div className="projects-list">
        {projects.map((project) => (
          <article key={project.id} className={`project-card ${project.id === selectedProjectId ? 'selected' : ''}`}>
            <button type="button" className="project-card-select" onClick={() => onSelect(project.id)}><strong>{project.name}</strong><small>{project.files?.length ?? 0} files</small></button>
            <button type="button" className="mini-delete" aria-label={`Delete ${project.name}`} onClick={() => onDelete(project.id)}><Trash2 size={13} /></button>
          </article>
        ))}
      </div>
    </aside>
  );
}

export function CreateProjectDialog({ name, onNameChange, onClose, onCreate, pending }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
        <header className="modal-header">
          <div><span className="eyebrow">NEW PROJECT</span><h3 id="create-project-title">Create a project</h3></div>
          <button className="icon-button" onClick={onClose} aria-label="Close create form"><X size={18} /></button>
        </header>
        <label className="field-label"><span>Project name</span><input autoFocus value={name} onChange={(event) => onNameChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onCreate(); }} placeholder="My new project" /></label>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} disabled={pending}>Cancel</button>
          <button className="primary-button" onClick={onCreate} disabled={pending}>{pending ? 'Saving…' : 'Create'}</button>
        </div>
      </section>
    </div>
  );
}

export function DeleteProjectDialog({ project, onClose, onConfirm, pending }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
      <section className="modal-card" role="alertdialog" aria-modal="true" aria-labelledby="delete-project-title" aria-describedby="delete-project-description">
        <header className="modal-header">
          <div><h3 id="delete-project-title">Are you sure you want to Delete {project.name} ?</h3></div>
          <button className="icon-button" onClick={onClose} aria-label="Close delete confirmation" disabled={pending}><X size={18} /></button>
        </header>
        <p className="delete-project-description" id="delete-project-description">This removes the project and its saved file references. Original files and the selected project folder will not be deleted.</p>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} disabled={pending}>Cancel</button>
          <button className="danger-button" onClick={onConfirm} disabled={pending}>{pending ? 'Deleting…' : 'Delete project'}</button>
        </div>
      </section>
    </div>
  );
}
