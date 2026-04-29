import { describe, expect, it } from "vitest";
import { getNextTheme, getThemeLabel } from "./theme";

describe("theme helpers", () => {
  it("cycles dark to light and light to dark", () => {
    expect(getNextTheme("dark")).toBe("light");
    expect(getNextTheme("light")).toBe("dark");
  });

  it("returns user-facing labels", () => {
    expect(getThemeLabel("dark")).toBe("Switch to light mode");
    expect(getThemeLabel("light")).toBe("Switch to dark mode");
  });
});
