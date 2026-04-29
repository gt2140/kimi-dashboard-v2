import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  getNextTheme,
  getThemeLabel,
  type DashboardTheme,
} from "@/lib/theme";

function isDashboardTheme(value: string | undefined): value is DashboardTheme {
  return value === "dark" || value === "light";
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme: DashboardTheme =
    mounted && isDashboardTheme(theme) ? theme : "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground/75 hover:text-foreground"
      aria-label={getThemeLabel(currentTheme)}
      title={getThemeLabel(currentTheme)}
      onClick={() => setTheme(getNextTheme(currentTheme))}
    >
      {currentTheme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
