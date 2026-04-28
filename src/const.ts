export const LOGIN_PATH = "/login";
export const AUTH_CALLBACK_PATH = "/auth/callback";

export function getAuthCallbackUrl() {
  if (typeof window === "undefined") {
    return AUTH_CALLBACK_PATH;
  }

  return new URL(AUTH_CALLBACK_PATH, window.location.origin).toString();
}
