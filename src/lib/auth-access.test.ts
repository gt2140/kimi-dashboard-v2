import { describe, expect, it } from "vitest";
import {
  canUseAuthenticatedApi,
  shouldShowAuthLoading,
} from "./auth-access";

describe("auth-access", () => {
  it("allows authenticated API access with a Supabase session even before backend sync is ready", () => {
    expect(
      canUseAuthenticatedApi({
        supabaseConfigured: true,
        hasSupabaseSession: true,
        backendReady: false,
      }),
    ).toBe(true);
  });

  it("blocks authenticated API access when Supabase is configured but no session exists", () => {
    expect(
      canUseAuthenticatedApi({
        supabaseConfigured: true,
        hasSupabaseSession: false,
        backendReady: false,
      }),
    ).toBe(false);
  });

  it("does not keep auth loading stuck on backend sync when a Supabase session already exists", () => {
    expect(
      shouldShowAuthLoading({
        sessionReady: true,
        logoutPending: false,
        supabaseConfigured: true,
        hasSupabaseSession: true,
        backendLoading: false,
        isAuthenticated: false,
      }),
    ).toBe(false);
  });

  it("keeps auth loading while the authenticated user query is still resolving", () => {
    expect(
      shouldShowAuthLoading({
        sessionReady: true,
        logoutPending: false,
        supabaseConfigured: true,
        hasSupabaseSession: true,
        backendLoading: true,
        isAuthenticated: false,
      }),
    ).toBe(true);
  });
});
