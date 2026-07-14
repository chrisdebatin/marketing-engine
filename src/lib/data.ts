import { createClient } from "@/lib/supabase/server";
import type { MaterialType } from "@/lib/types";

/** Material catalog (Flyer, Aufsteller, …), ordered. */
export async function getMaterialTypes(): Promise<MaterialType[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("material_types")
    .select("*")
    .order("sort_order")
    .order("name");
  return data ?? [];
}

/** Autocomplete suggestions for the given hubs (RLS already scopes to the user). */
export async function getStandortSuggestions(
  hubIds: string[],
): Promise<{ hub_id: string; name: string }[]> {
  if (hubIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("standorte")
    .select("hub_id, name")
    .in("hub_id", hubIds)
    .order("name");
  return data ?? [];
}
