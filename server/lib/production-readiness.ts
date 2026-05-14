type ProductionReadinessEnv = {
  appSecret: string;
  databaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  veniceApiKey: string;
  veniceModel: string;
};

type ProductionReadinessCheckName =
  | "SESSION_SECRET"
  | "DATABASE_URL"
  | "SUPABASE_URL"
  | "SUPABASE_ANON_KEY"
  | "VENICE_API_KEY_OR_VENICE_INFERENCE_KEY"
  | "VENICE_MODEL";

function hasValue(value: string) {
  return value.trim().length > 0;
}

export function buildProductionReadinessPayload(env: ProductionReadinessEnv) {
  const checks = {
    sessionSecret: hasValue(env.appSecret),
    database: hasValue(env.databaseUrl),
    supabaseUrl: hasValue(env.supabaseUrl),
    supabaseAnonKey: hasValue(env.supabaseAnonKey),
    veniceKey: hasValue(env.veniceApiKey),
    veniceModel: hasValue(env.veniceModel),
  };

  const missing: ProductionReadinessCheckName[] = [];
  if (!checks.sessionSecret) missing.push("SESSION_SECRET");
  if (!checks.database) missing.push("DATABASE_URL");
  if (!checks.supabaseUrl) missing.push("SUPABASE_URL");
  if (!checks.supabaseAnonKey) missing.push("SUPABASE_ANON_KEY");
  if (!checks.veniceKey) {
    missing.push("VENICE_API_KEY_OR_VENICE_INFERENCE_KEY");
  }
  if (!checks.veniceModel) missing.push("VENICE_MODEL");

  return {
    ok: missing.length === 0,
    service: "aura-dashboard",
    chatProvider: "venice",
    defaultModel: env.veniceModel || null,
    checks,
    missing,
  };
}
