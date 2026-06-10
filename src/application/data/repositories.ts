import { getRuntimeConfig } from "@/config/env";
import { createDemoRepositories } from "@/infrastructure/demo/repositories";
import { createSupabaseRepositories, type ReimagineRepositories } from "@/infrastructure/supabase/repositories";

export function createRepositories(): ReimagineRepositories {
  return getRuntimeConfig().isSupabaseConfigured ? createSupabaseRepositories() : createDemoRepositories();
}
