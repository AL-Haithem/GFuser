import { X } from 'lucide-react';
import { ThemeControl } from '../appearance/AppearanceFeature.jsx';
import { UpdateSettings } from '../update/UpdatesFeature.jsx';
import './settings.css';

export default function SettingsFeature({ open, onClose, theme, onThemeChange, updateState, updateStatusLabel, updateActionPending, preferencePending, onCheckUpdates, onAutomaticUpdatesChange, onDownloadUpdate, onInstallUpdate }) {
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
