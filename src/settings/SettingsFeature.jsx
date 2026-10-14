import { AlertCircle, CheckCircle2, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { ThemeControl } from '../appearance/AppearanceFeature.jsx';
import { UpdateSettings } from '../update/UpdatesFeature.jsx';
import './settings.css';

export default function SettingsFeature({ open, onClose, theme, onThemeChange, updateState, updateStatusLabel, updateActionPending, preferencePending, toolStatuses, toolCheckPending, onCheckTools, onCheckUpdates, onAutomaticUpdatesChange, onDownloadUpdate, onInstallUpdate }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-card settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="modal-header">
          <h2 id="settings-title">Settings</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={18} /></button>
        </header>
        <section className="settings-section">
          <h3>Appearance</h3>
          <ThemeControl theme={theme} onChange={onThemeChange} />
        </section>
        <div className="settings-divider" />
        <section className="settings-section">
          <div className="tool-section-heading">
            <h3>Tools</h3>
            <button className="icon-button" type="button" onClick={onCheckTools} disabled={toolCheckPending} aria-label="Check tools again" title="Check tools again">
              <RefreshCw size={16} className={toolCheckPending ? 'tool-check-spinning' : ''} />
            </button>
          </div>
          <div className="tool-status-list" aria-live="polite">
            {toolStatuses.map((tool) => {
              const StatusIcon = tool.status === 'ready' ? CheckCircle2 : tool.status === 'checking' ? LoaderCircle : AlertCircle;
              const label = tool.status === 'ready' ? 'Ready' : tool.status === 'checking' ? 'Checking' : tool.status === 'missing' ? 'Missing files' : 'Unavailable';
              return (
                <div className="tool-status-row" key={tool.id}>
                  <StatusIcon className={`tool-status-icon is-${tool.status}`} size={18} />
                  <div className="tool-status-copy">
                    <div className="tool-status-title"><strong>{tool.name}</strong><span className={`tool-status-label is-${tool.status}`}>{label}</span></div>
                    <p>{tool.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <div className="settings-divider" />
        <section className="settings-section">
          <h3>Software updates</h3>
          <UpdateSettings
            updateState={updateState}
            statusLabel={updateStatusLabel}
            pending={updateActionPending}
            preferencePending={preferencePending}
            onCheck={onCheckUpdates}
            onPreferenceChange={onAutomaticUpdatesChange}
            onDownload={onDownloadUpdate}
            onInstall={onInstallUpdate}
          />
        </section>
      </section>
    </div>
  );
}
