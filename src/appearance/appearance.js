export function saveTheme(theme) {
  if (!window.appAPI?.saveTheme) return Promise.resolve();
  return window.appAPI.saveTheme(theme);
}
