import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL?.trim();
  const appID = import.meta.env.VITE_APP_ID?.trim();

  if (!kimiAuthUrl || !appID) {
    throw new Error(
      "Missing VITE_KIMI_AUTH_URL or VITE_APP_ID. Add them to your .env file.",
    );
  }

  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${kimiAuthUrl}/api/oauth/authorize`);
  url.searchParams.set("client_id", appID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);

  return url.toString();
}

export default function Login() {
  const isOAuthConfigured = Boolean(
    import.meta.env.VITE_KIMI_AUTH_URL?.trim() &&
      import.meta.env.VITE_APP_ID?.trim(),
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Sparkles className="h-5 w-5 text-muted-foreground/20 mb-4" />
      <h1 className="text-[15px] font-medium text-foreground mb-6">Aura</h1>
      <Button
        size="sm"
        className="h-8 text-[12px]"
        disabled={!isOAuthConfigured}
        onClick={() => { window.location.href = getOAuthUrl(); }}
      >
        Continue with Kimi
      </Button>
      {!isOAuthConfigured && (
        <p className="mt-3 max-w-xs text-center text-[11px] text-muted-foreground/45">
          Set <code>VITE_KIMI_AUTH_URL</code> and <code>VITE_APP_ID</code> in your <code>.env</code> file to enable login.
        </p>
      )}
    </div>
  );
}
