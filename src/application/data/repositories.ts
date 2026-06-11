import { createSupabaseRepositories, type ReimagineRepositories } from "@/infrastructure/supabase/repositories";

export function createRepositories(): ReimagineRepositories {
  return createSupabaseRepositories();
}
