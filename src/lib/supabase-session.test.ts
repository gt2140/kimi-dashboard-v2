import { describe, expect, it } from "vitest";
import { clearSupabaseBrowserState } from "./supabase-session";

function createStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries));

  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe("clearSupabaseBrowserState", () => {
  it("removes only supabase browser state keys", () => {
    const localStorage = createStorage({
      "sb-project-auth-token": "1",
      "sb-project-code-verifier": "2",
      theme: "dark",
    });
    const sessionStorage = createStorage({
      "sb-project-auth-token-code-verifier": "3",
      other: "value",
    });

    clearSupabaseBrowserState({ localStorage, sessionStorage });

    expect(localStorage.getItem("sb-project-auth-token")).toBeNull();
    expect(localStorage.getItem("sb-project-code-verifier")).toBeNull();
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(sessionStorage.getItem("sb-project-auth-token-code-verifier")).toBeNull();
    expect(sessionStorage.getItem("other")).toBe("value");
  });
});
