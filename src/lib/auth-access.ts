type AuthenticatedAccessInput = {
  supabaseConfigured: boolean;
  hasSupabaseSession: boolean;
  backendReady: boolean;
};

type AuthLoadingInput = {
  sessionReady: boolean;
  logoutPending: boolean;
  supabaseConfigured: boolean;
  hasSupabaseSession: boolean;
  backendLoading: boolean;
  isAuthenticated: boolean;
};

export function canUseAuthenticatedApi(input: AuthenticatedAccessInput) {
  if (!input.supabaseConfigured) {
    return true;
  }

  return input.hasSupabaseSession || input.backendReady;
}

export function shouldShowAuthLoading(input: AuthLoadingInput) {
  if (!input.sessionReady || input.logoutPending) {
    return true;
  }

  if (!input.supabaseConfigured) {
    return input.backendLoading;
  }

  if (!input.hasSupabaseSession) {
    return false;
  }

  return input.backendLoading && !input.isAuthenticated;
}

