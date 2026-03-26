import { useEffect } from 'react';
import { useThemeStore } from '../stores/themeStore';

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <button
      type="button"
      className="ez-theme-toggle"
      onClick={toggleTheme}
      title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
      aria-label={theme === 'light' ? 'Dark theme' : 'Light theme'}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
