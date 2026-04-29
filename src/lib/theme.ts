export type DashboardTheme = "dark" | "light";

export function getNextTheme(theme: DashboardTheme): DashboardTheme {
  return theme === "dark" ? "light" : "dark";
}

export function getThemeLabel(theme: DashboardTheme) {
  return theme === "dark"
    ? "Switch to light mode"
    : "Switch to dark mode";
}
