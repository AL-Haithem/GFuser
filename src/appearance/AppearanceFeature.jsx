import { Moon, Sun } from 'lucide-react';
import './appearance.css';

export function ThemeControl({ theme, onChange }) {
  return (
    <div className="theme-switcher" role="group" aria-label="Color theme">
      <button type="button" className={theme === 'light' ? 'active' : ''} onClick={() => onChange('light')}><Sun size={14} /> Light</button>
      <button type="button" className={theme === 'dark' ? 'active' : ''} onClick={() => onChange('dark')}><Moon size={14} /> Dark</button>
    </div>
  );
}

export function AppearanceFeature({ theme, onChange }) {
  return (
    <section className="info-card appearance-feature">
      <div className="card-header">
        <div><span className="eyebrow">THEME</span><h3>Appearance</h3></div>
        {theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
      </div>
      <ThemeControl theme={theme} onChange={onChange} />
    </section>
  );
}
