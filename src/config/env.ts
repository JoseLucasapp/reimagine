type ViteRuntimeEnv = Record<string, string | boolean | undefined>;

const env = import.meta.env as unknown as ViteRuntimeEnv;

function readString(key: string): string | null {
  const value = env[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type RuntimeConfig = {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  isSupabaseConfigured: boolean;
};

export function getRuntimeConfig(): RuntimeConfig {
  const supabaseUrl = readString("VITE_SUPABASE_URL");
  const supabaseAnonKey = readString("VITE_SUPABASE_ANON_KEY");

  return {
    supabaseUrl,
    supabaseAnonKey,
    isSupabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
  };
}
