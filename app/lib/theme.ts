export type AppTheme =
  | "classic"
  | "black"
  | "white"
  | "legacy-dark"
  | "legacy-light";

const THEME_KEY = "app_theme";
const LEGACY_THEME_MAP: Record<string, AppTheme> = {
  dark: "legacy-dark",
  light: "legacy-light",
  classic: "classic",
  black: "black",
  white: "white",
  "legacy-dark": "legacy-dark",
  "legacy-light": "legacy-light",
};

export function applyTheme(theme: AppTheme) {
  if (typeof window === "undefined") return;

  const root = document.documentElement;
  const isDarkTheme =
    theme === "classic" || theme === "black" || theme === "legacy-dark";

  root.dataset.rivnTheme = theme;

  if (isDarkTheme) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  localStorage.setItem(THEME_KEY, theme);
}

export function getStoredTheme(): AppTheme {
  if (typeof window === "undefined") return "classic";

  const saved = localStorage.getItem(THEME_KEY);
  return LEGACY_THEME_MAP[saved ?? ""] ?? "classic";
}

export function initTheme() {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}

export function setTheme(theme: AppTheme): AppTheme {
  applyTheme(theme);
  return theme;
}
