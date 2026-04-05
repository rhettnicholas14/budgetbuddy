import { createBrowserClient } from "@supabase/ssr";
import { appEnv } from "@/lib/env";

export function createSupabaseBrowserClient() {
  return createBrowserClient(appEnv.supabaseUrl, appEnv.supabaseAnonKey);
}
