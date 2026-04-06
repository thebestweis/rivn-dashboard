export type AppTheme = "dark" | "light";

const THEME_KEY = "app_theme";

export function applyTheme(theme: AppTheme) {
  if (typeof window === "undefined") return;

  const root = document.documentElement;

  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  localStorage.setItem(THEME_KEY, theme);
}

export function getStoredTheme(): AppTheme {
  if (typeof window === "undefined") return "dark";

  const saved = localStorage.getItem(THEME_KEY);
  return saved === "light" ? "light" : "dark";
}

export function initTheme() {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}

export function toggleTheme(current: AppTheme): AppTheme {
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}