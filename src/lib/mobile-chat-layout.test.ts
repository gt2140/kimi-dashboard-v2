import { describe, expect, it } from "vitest";
import {
  getChatComposerShellClassName,
  getChatScrollAreaClassName,
  getChatShellClassName,
} from "./mobile-chat-layout";

describe("mobile chat layout", () => {
  it("docks the mobile chat composer without leaving dead space under it", () => {
    expect(getChatShellClassName()).toContain("h-[100dvh]");
    expect(getChatShellClassName()).not.toContain("h-[calc(100dvh-3rem)]");

    expect(getChatScrollAreaClassName()).toContain("pb-3");
    expect(getChatComposerShellClassName()).toContain("pb-[max(0.35rem,env(safe-area-inset-bottom))]");
    expect(getChatComposerShellClassName()).toContain("sm:pb-3");
  });
});
