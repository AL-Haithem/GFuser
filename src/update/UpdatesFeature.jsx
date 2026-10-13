import { CircleAlert, CircleCheck, Download, RefreshCw } from 'lucide-react';
import './updates.css';

export function UpdateStatusCard({ statusLabel, automaticUpdatesEnabled }) {
  return (
    <section className="info-card update-summary-feature">
      <div className="card-header">
        <div><span className="eyebrow">APP STATUS</span><h3>Desktop workspace</h3></div>
        <span className="online-dot" />
      </div>
      <p>Projects and software updates are managed from this desktop app.</p>
      <div className="status-row"><span>Update state</span><strong>{statusLabel}</strong></div>
      <div className="status-row"><span>Automatic updates</span><strong>{automaticUpdatesEnabled ? 'Enabled' : 'Disabled'}</strong></div>
    </section>
  );
}

export function UpdateSettings({ updateState, statusLabel, pending, preferencePending, onCheck, onPreferenceChange, onDownload, onInstall }) {
  const isBusy = updateState.status === 'checking' || updateState.status === 'downloading';
  return (
    <section className="update-settings-feature">
      <div className={`update-state-row state-${updateState.status}`}>
        <span className="update-icon">
          {updateState.status === 'error' ? <CircleAlert size={17} /> : updateState.status === 'up-to-date' || updateState.status === 'downloaded' ? <CircleCheck size={17} /> : <RefreshCw size={17} className={isBusy ? 'spinning' : ''} />}
        </span>
        <div><strong>Software updates <small className="update-status-label">{statusLabel}</small></strong><p>{updateState.message}</p></div>
      </div>
      <div className="settings-row"><span>Installed version</span><strong>v{updateState.currentVersion || '...'}</strong></div>
      {updateState.status === 'downloading' && (
        <div className="progress-wrap">
          <div className="progress-head"><span>Download progress</span><strong>{updateState.progress}%</strong></div>
          <div
            className="progress-bar"
            role="progressbar"
            aria-valuenow={updateState.progress}
            aria-valuemin="0"
            aria-valuemax="100"
            style={{ '--progress': `${updateState.progress}%` }}
          >
            <span className="progress-bar-fill" />
          </div>
        </div>
      )}
      <label className="toggle-row">
        <span><strong>Automatic updates</strong></span>
        <input type="checkbox" checked={updateState.automaticUpdatesEnabled} disabled={preferencePending} onChange={onPreferenceChange} aria-label="Automatic updates" />
        <span className="switch-track" aria-hidden="true"><span /></span>
      </label>
      <div className="update-actions">
        <button className="secondary-button" onClick={onCheck} disabled={pending || isBusy}><RefreshCw size={14} className={isBusy ? 'spinning' : ''} />Check now</button>
        {updateState.status === 'available' && !updateState.automaticUpdatesEnabled && <button className="primary-button" onClick={onDownload} disabled={pending}><Download size={14} />Download</button>}
        {updateState.status === 'downloaded' && <button className="primary-button" onClick={onInstall} disabled={pending}><RefreshCw size={14} />Restart to install</button>}
      </div>
    </section>
  );
}
