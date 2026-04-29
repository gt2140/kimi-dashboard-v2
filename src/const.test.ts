import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTH_CALLBACK_PATH, getAuthCallbackUrl } from "./const";

describe("getAuthCallbackUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("derives the callback from the active origin", () => {
    vi.stubGlobal("window", {
      location: {
        origin: "https://demo.example.com",
      },
    });

    expect(getAuthCallbackUrl()).toBe(
      "https://demo.example.com/auth/callback"
    );
  });

  it("falls back to the path when window is unavailable", () => {
    vi.stubGlobal("window", undefined);

    expect(getAuthCallbackUrl()).toBe(AUTH_CALLBACK_PATH);
  });
});
