/** LocalStorage keys for the EziLearning Cursor proxy log UI (migrates legacy keys once). */
const THEME = 'ezilearning_cursor_proxy_theme';
const THEME_LEGACY = 'cursor2api_theme';
const TOKEN = 'ezilearning_cursor_proxy_token';
const TOKEN_LEGACY = 'cursor2api_token';

function migrateKey(newKey: string, legacyKey: string): void {
  const v = localStorage.getItem(newKey);
  if (v !== null) return;
  const old = localStorage.getItem(legacyKey);
  if (old === null) return;
  localStorage.setItem(newKey, old);
  localStorage.removeItem(legacyKey);
}

export function getStoredTheme(): string {
  migrateKey(THEME, THEME_LEGACY);
  return localStorage.getItem(THEME) ?? 'light';
}

export function setStoredTheme(t: string): void {
  localStorage.setItem(THEME, t);
  localStorage.removeItem(THEME_LEGACY);
}

export function getStoredToken(): string | null {
  migrateKey(TOKEN, TOKEN_LEGACY);
  return localStorage.getItem(TOKEN);
}

export function setStoredToken(t: string): void {
  localStorage.setItem(TOKEN, t);
  localStorage.removeItem(TOKEN_LEGACY);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN);
  localStorage.removeItem(TOKEN_LEGACY);
}
