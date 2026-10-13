import { Check, Circle, CircleAlert, Database, LoaderCircle } from 'lucide-react';
import { getStartupProgress } from './startup.js';
import './startup.css';

function StartupStepIcon({ status }) {
  if (status === 'complete') return <Check size={15} />;
  if (status === 'error') return <CircleAlert size={15} />;
  if (status === 'loading') return <LoaderCircle size={15} className="startup-spinner" />;
  return <Circle size={15} />;
}

export default function StartupFeature({ steps, version, theme }) {
  const progress = getStartupProgress(steps);

  return (
    <main className={`app-shell startup-shell ${theme === 'dark' ? 'theme-dark' : ''}`} role="status" aria-live="polite">
      <section className="startup-content">
        <header className="startup-brand">
          <span className="startup-mark"><Database size={21} /></span>
          <span>MapFusion</span>
        </header>
        <div className="startup-heading">
          <span className="eyebrow">DESKTOP APP</span>
          <h1>Preparing your workspace</h1>
          <p>Initializing app data and services.</p>
        </div>
        <div
          className="startup-progress-track"
          role="progressbar"
          aria-label="Startup progress"
          aria-valuenow={progress}
          aria-valuemin="0"
          aria-valuemax="100"
          style={{ '--progress': `${progress}%` }}
        >
          <span className="startup-progress-fill" />
        </div>
        <ol className="startup-steps">
          {steps.map((step) => (
            <li key={step.id} className={`startup-step startup-step-${step.status}`}>
              <span className="startup-step-icon"><StartupStepIcon status={step.status} /></span>
              <span>{step.label}</span>
              <span className="startup-step-state">{step.status === 'complete' ? 'Ready' : step.status === 'error' ? 'Unavailable' : step.status === 'loading' ? 'Checking' : 'Waiting'}</span>
            </li>
          ))}
        </ol>
        <footer className="startup-footer">{version ? `Version ${version}` : 'Starting MapFusion'}</footer>
      </section>
    </main>
  );
}
