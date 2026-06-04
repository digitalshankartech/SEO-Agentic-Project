import { useEffect, useState } from 'react';
import { getStoredTheme, saveTheme, THEME_OPTIONS } from '../lib/theme';

const LABELS = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getStoredTheme);

  useEffect(() => {
    const handleThemeChange = (event) => setTheme(event.detail || getStoredTheme());
    const handleSystemChange = () => {
      if (getStoredTheme() === 'system') saveTheme('system');
    };
    window.addEventListener('theme-changed', handleThemeChange);
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', handleSystemChange);
    return () => {
      window.removeEventListener('theme-changed', handleThemeChange);
      window.matchMedia?.('(prefers-color-scheme: dark)').removeEventListener('change', handleSystemChange);
    };
  }, []);

  function selectTheme(value) {
    setTheme(value);
    saveTheme(value);
  }

  return (
    <div className="border-t border-slate-800 px-3 py-3">
      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
        Theme
      </p>
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-1">
        {THEME_OPTIONS.map((option) => {
          const active = theme === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => selectTheme(option)}
              className={`rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors ${
                active
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              {LABELS[option]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
