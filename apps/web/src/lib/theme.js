export const THEME_STORAGE_KEY = 'marketing-suite:theme';
export const THEME_OPTIONS = ['light', 'dark', 'system'];

export function getStoredTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return THEME_OPTIONS.includes(stored) ? stored : 'system';
}

export function getSystemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(theme) {
  return theme === 'system' ? getSystemTheme() : theme;
}

export function applyTheme(theme) {
  const resolved = resolveTheme(theme);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.style.colorScheme = resolved;
}

export function saveTheme(theme) {
  const nextTheme = THEME_OPTIONS.includes(theme) ? theme : 'system';
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  applyTheme(nextTheme);
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: nextTheme }));
}

export function initTheme() {
  applyTheme(getStoredTheme());
}
