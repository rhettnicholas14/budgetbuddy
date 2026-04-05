const requiredServerKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

export const appEnv = {
  appName: "Household Spend Tracker",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  basiqApiKey: process.env.BASIQ_API_KEY ?? "",
  basiqApiUrl: process.env.BASIQ_API_URL ?? "https://au-api.basiq.io",
  basiqWebhookSecret: process.env.BASIQ_WEBHOOK_SECRET ?? "",
  mockMode: process.env.NEXT_PUBLIC_APP_MODE !== "live",
};

export function hasSupabaseEnv() {
  return requiredServerKeys.every((key) => Boolean(process.env[key]));
}

export function hasBasiqEnv() {
  return Boolean(appEnv.basiqApiKey);
}

export function hasOpenAiEnv() {
  return Boolean(appEnv.openAiApiKey);
}
